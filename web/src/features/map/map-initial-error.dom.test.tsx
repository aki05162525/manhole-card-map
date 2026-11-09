import { act, cleanup, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { Map } from "../../components/ui/map";
const fake = vi.hoisted(() => ({
  listeners: new globalThis.Map<string, Set<(e: unknown) => void>>(),
  calls: [] as string[],
}));
vi.mock("maplibre-gl", () => ({
  getWorkerUrl: () => "/worker",
  Map: class {
    painter = {};
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
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
it("E2 catches a broken style URL before children mount, within five seconds", async () => {
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  }));
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
