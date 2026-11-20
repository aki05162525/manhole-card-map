import { act, cleanup, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { MapOptions } from "maplibre-gl";
import { Map, MapClusterLayer } from "../../components/ui/map";
// The vendored mapcn Map on a fake MapLibre that records how it was created.
const fake = vi.hoisted(() => ({
  listeners: new globalThis.Map<string, Set<(e: unknown) => void>>(),
  expand: vi.fn<() => Promise<number>>(),
  easeTo: vi.fn(),
  fire: vi.fn(),
  calls: [] as string[],
  created: [] as MapOptions[],
}));
vi.mock("maplibre-gl", () => ({
  getWorkerUrl: () => "/worker",
  ErrorEvent: class {
    readonly type = "error";
    constructor(readonly error: Error) {}
  },
  Map: class {
    painter = {};
    constructor(options: MapOptions) {
      fake.created.push(options);
    }
    addLayer() {}
    addSource() {}
    removeSource() {}
    getLayer() {}
    getSource() {
      return { getClusterExpansionZoom: fake.expand };
    }
    queryRenderedFeatures() {
      return [
        { properties: { cluster_id: 3 }, geometry: { coordinates: [139, 35] } },
      ];
    }
    easeTo = fake.easeTo;
    fire = fake.fire;
    on(
      name: string,
      target: string | ((e: unknown) => void),
      listener?: (e: unknown) => void,
    ) {
      const fn = typeof target === "string" ? listener! : target;
      if (typeof target === "string") name += ":" + target;
      fake.calls.push(name);
      if (!fake.listeners.has(name)) fake.listeners.set(name, new Set());
      fake.listeners.get(name)!.add(fn);
    }
    off(
      name: string,
      target: string | ((e: unknown) => void),
      listener?: (e: unknown) => void,
    ) {
      const fn = typeof target === "string" ? listener! : target;
      if (typeof target === "string") name += ":" + target;
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
  vi.clearAllMocks();
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

it("reports cluster expansion errors and discards a zoom after unmount", async () => {
  stubMatchMedia();
  const view = render(
    <Map theme="light">
      <MapClusterLayer data="/clusters.json" />
    </Map>,
  );
  await act(async () => {
    await vi.waitFor(() => expect(fake.listeners.has("load")).toBe(true));
    for (const name of ["style.load", "load"])
      for (const fn of fake.listeners.get(name) ?? []) fn({});
  });
  const key = fake.calls.find((name) => name.startsWith("click:clusters-"))!;
  const [click] = fake.listeners.get(key)!;
  const error = Error("cluster missing");
  fake.expand.mockRejectedValueOnce(error);
  click({ point: [0, 0] });
  await vi.waitFor(() =>
    expect(fake.fire).toHaveBeenCalledWith(
      expect.objectContaining({ type: "error", error }),
    ),
  );
  fake.expand.mockResolvedValueOnce(11);
  click({ point: [0, 0] });
  await vi.waitFor(() =>
    expect(fake.easeTo).toHaveBeenCalledWith({ center: [139, 35], zoom: 11 }),
  );
  let finish!: (zoom: number) => void;
  const zoom = new Promise<number>((resolve) => {
    finish = resolve;
  });
  fake.expand.mockReturnValueOnce(zoom);
  click({ point: [0, 0] });
  view.unmount();
  finish(15);
  await zoom;
  expect(fake.easeTo).toHaveBeenCalledTimes(1);
});
