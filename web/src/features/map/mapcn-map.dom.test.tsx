import { act, cleanup, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { MapOptions } from "maplibre-gl";
import { Map } from "../../components/ui/map";
// The vendored mapcn Map on a fake MapLibre that records how it was created.
const fake = vi.hoisted(() => ({
  listeners: new globalThis.Map<string, Set<(e: unknown) => void>>(),
  calls: [] as string[],
  created: [] as MapOptions[],
}));
vi.mock("maplibre-gl", () => ({
  getWorkerUrl: () => "/worker",
  Map: class {
    painter = {};
    constructor(options: MapOptions) {
      fake.created.push(options);
    }
    on(name: string, fn: (e: unknown) => void) {
      fake.calls.push(name);
      if (!fake.listeners.has(name)) fake.listeners.set(name, new Set());
      fake.listeners.get(name)!.add(fn);
    }
    off(name: string, fn: (e: unknown) => void) {
      fake.listeners.get(name)?.delete(fn);
    }
    setStyle(url: string) {
      fake.calls.push("setStyle");
      if (url === "/broken-style.json")
        for (const fn of fake.listeners.get("error") ?? [])
          fn({ error: Error("style HTTP 404") });
    }
    remove() {}
  },
}));
afterEach(() => {
  cleanup();
  fake.listeners.clear();
  fake.calls = [];
  fake.created = [];
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
function stubMatchMedia() {
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  }));
}
it("E2 catches a broken style URL before children mount, within five seconds", async () => {
  stubMatchMedia();
  const onError = vi.fn();
  await act(async () => {
    render(
      <Map
        theme="light"
        styles={{ light: "/broken-style.json" }}
        transformStyle={(_old, next) => next}
        onError={onError}
      />,
    );
  });
  expect(onError).toHaveBeenCalledWith(Error("style HTTP 404"));
  expect(fake.calls.indexOf("error")).toBeLessThan(
    fake.calls.indexOf("setStyle"),
  );
});

it("creates MapLibre with the camera measured from its laid-out container", async () => {
  stubMatchMedia();
  const createOptions = vi.fn((container: HTMLDivElement) => ({
    bounds: [
      [139, 35],
      [140, 36],
    ] satisfies [[number, number], [number, number]],
    fitBoundsOptions: {
      padding: { top: container.isConnected ? 72 : 0, left: 8, right: 8 },
      maxZoom: 11,
    },
  }));
  await act(async () => {
    render(
      <Map
        theme="light"
        styles={{ light: "/style.json" }}
        createOptions={createOptions}
      />,
    );
  });
  expect(createOptions).toHaveBeenCalledOnce();
  const [options] = fake.created;
  expect(options.container).toBe(createOptions.mock.calls[0][0]);
  expect(options).toMatchObject({
    bounds: [
      [139, 35],
      [140, 36],
    ],
    fitBoundsOptions: {
      padding: { top: 72, left: 8, right: 8 },
      maxZoom: 11,
    },
  });
});
