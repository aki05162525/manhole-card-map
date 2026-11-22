import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { StrictMode } from "react";
import { createMapRuntime, mapErrorText } from "./map-runtime";
import type { Map as MapLibreMap, StyleSpecification } from "maplibre-gl";
import { transformBasemapStyle } from "./basemap-style";
import type { MapProps } from "../../components/ui/map";
import {
  fakeMapLibre as createFakeMapLibre,
  type FakeFeature,
} from "./fake-maplibre";
import CardMap, { type CardMapProps, mapStyles } from "./card-map";
import { focusForPrefTap, focusCamera, pinFilter } from "./map-levels";
import { pinsGeoJSON } from "./mapcn-data";
import { mapPalette } from "./map-theme";
import { ScreenActivity } from "../../shared/browser/screen-activity";
import type { Pin } from "../../domain/types";
vi.hoisted(() => {
  window.enableMapDiagnostics = true;
});

const context = vi.hoisted(() => ({
  map: null as MapLibreMap | null,
  isLoaded: false,
  /** Before the first tiles: null follows `isLoaded`. */
  isStyleLoaded: null as boolean | null,
  options: {} as MapProps,
  broken: false,
}));
vi.mock("../../components/ui/map", () => ({
  Map: ({ children, ...options }: MapProps) => {
    context.options = options;
    if (context.broken) throw new Error("render failed");
    return children;
  },
  MapControls: () => null,
  useMap: () => ({
    ...context,
    isStyleLoaded: context.isStyleLoaded ?? context.isLoaded,
  }),
}));
vi.mock("../../shared/browser/painted", () => ({
  painted: () => Promise.resolve(),
}));
const pin = {
  id: "p",
  cardIds: ["c"],
  lat: 35.6,
  lng: 139.7,
  pref: "東京都",
  kind: "place",
  status: "active",
} satisfies Pin;
// Every map of a test, to check afterwards that MapLibre refused nothing:
// a refusal is an `error` event, which the user sees as a failed map.
const fakes: ReturnType<typeof createFakeMapLibre>[] = [];
function fakeMapLibre(options?: Parameters<typeof createFakeMapLibre>[0]) {
  const fake = createFakeMapLibre(options);
  fakes.push(fake);
  return fake;
}
function props(): CardMapProps {
  return {
    pinsLoaded: true,
    focus: { area: null, pref: null },
    pins: [pin],
    countPinsSource: [pin],
    selectedPins: [],
    onFocus: vi.fn(),
    onSelect: vi.fn(),
    onDismiss: vi.fn(),
    onReady: vi.fn(),
    onError: vi.fn(),
    onWarning: vi.fn(),
  };
}
beforeEach(() => {
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  vi.stubGlobal(
    "fetch",
    vi.fn(() => new Promise(() => {})),
  );
  context.isLoaded = false;
  context.isStyleLoaded = null;
  context.broken = false;
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
  for (const fake of fakes.splice(0)) expect(fake.errors).toEqual([]);
});
/** A loaded map on the screen, with the props it was given. */
function shown(
  options?: Parameters<typeof createFakeMapLibre>[0],
  change: Partial<CardMapProps> = {},
) {
  const fake = fakeMapLibre(options);
  context.map = fake.maplibre;
  context.isLoaded = true;
  const initial = { ...props(), ...change };
  const view = render(<CardMap {...initial} />);
  return { fake, initial, view };
}
const at = (
  x: number,
  y: number,
  properties: Record<string, unknown>,
): FakeFeature => ({
  type: "Feature",
  geometry: { type: "Point", coordinates: [x, y] },
  properties,
});
const pinAt = (x: number, y: number, id = "p", cardIds = ["c"]) =>
  at(x, y, { id, cardIds: JSON.stringify(cardIds) });
const badge = (x: number, y: number, kind: string, id: string) =>
  at(x, y, { kind, id });
const tap = (fake: ReturnType<typeof fakeMapLibre>, x: number, y: number) =>
  act(() => fake.emit("click", { point: { x, y } }));
/** The filter last set on the facility pins. */
const placeFilter = (fake: ReturnType<typeof fakeMapLibre>) =>
  fake.map.setFilter.mock.calls
    .filter(([id]) => id === "card-pins-place")
    .at(-1)?.[1];
test("selection before style readiness owns the camera and ready fires once", () => {
  const fake = fakeMapLibre();
  context.map = fake.maplibre;
  const initial = props();
  const view = render(<CardMap {...initial} />);
  const selected = {
    ...initial,
    selectedPins: [pin],
    focus: focusForPrefTap("東京都"),
  };
  view.rerender(<CardMap {...selected} />);
  context.isLoaded = true;
  view.rerender(<CardMap {...selected} />);
  expect(fake.sources.get("card-selected")?.setData).toHaveBeenLastCalledWith(
    pinsGeoJSON([pin]),
  );
  expect(fake.map.fitBounds).toHaveBeenCalledTimes(1);
  act(() => {
    fake.emit("idle");
    fake.emit("idle");
  });
  expect(selected.onReady).toHaveBeenCalledTimes(1);
  expect(fake.map.fitBounds).toHaveBeenCalledTimes(1);
  expect(fake.map.fitBounds.mock.calls[0][2]).toEqual({ fromApp: true });
  expect(fake.map.fitBounds.mock.calls[0][0]).toEqual([
    [pin.lng, pin.lat],
    [pin.lng, pin.lat],
  ]);
  expect(fake.map.fitBounds.mock.calls[0][1]).toMatchObject({
    maxZoom: 15,
    padding: { top: 0, bottom: 411.5 },
  });
  const adapter = vi.mocked(selected.onReady).mock.calls[0][0];
  act(() => {
    adapter.locate(35, 139);
    fake.emit("zoomstart", { originalEvent: {}, fromApp: true });
    fake.emit("dragstart", { originalEvent: {} });
  });
  expect(selected.onDismiss).not.toHaveBeenCalled();
  act(() => fake.emit("zoomstart", { originalEvent: {} }));
  expect(selected.onDismiss).toHaveBeenCalledTimes(1);
});
test("the pins are installed once the style has loaded, before the basemap's first tiles", () => {
  const fake = fakeMapLibre();
  context.map = fake.maplibre;
  context.isStyleLoaded = true;
  render(<CardMap {...props()} />);
  expect(fake.sources.get("card-pins")?.setData).toHaveBeenLastCalledWith(
    pinsGeoJSON([pin]),
  );
});
test("a prefecture's map is handed over when its pins are drawn, while the basemap still loads", () => {
  const { fake, initial } = shown(undefined, {
    focus: focusForPrefTap("東京都"),
  });
  // Frames with no pin yet: nothing to press.
  act(() => fake.emit("render"));
  expect(initial.onReady).not.toHaveBeenCalled();
  fake.draw("card-pins-place", [pinAt(100, 100)]);
  act(() => fake.emit("render"));
  expect(initial.onReady).toHaveBeenCalledTimes(1);
  act(() => {
    fake.emit("render");
    fake.emit("idle");
  });
  expect(initial.onReady).toHaveBeenCalledTimes(1);
});
test("the counts are handed over with the whole view, not with their first frame", () => {
  const { fake, initial } = shown();
  fake.draw("card-level-counts", [badge(100, 100, "area", "kanto")]);
  fake.draw("card-pins-place", [pinAt(100, 100)]);
  act(() => fake.emit("render"));
  expect(initial.onReady).not.toHaveBeenCalled();
  act(() => fake.emit("idle"));
  expect(initial.onReady).toHaveBeenCalledTimes(1);
});
test("a level chosen before the map is handed over is opened without the move being played", () => {
  const { fake, initial, view } = shown();
  view.rerender(<CardMap {...initial} focus={focusForPrefTap("東京都")} />);
  expect(fake.map.fitBounds).toHaveBeenCalledTimes(1);
  expect(fake.map.fitBounds.mock.calls[0][1]).toMatchObject({ duration: 0 });
  act(() => fake.emit("idle"));
  view.rerender(<CardMap {...initial} focus={focusForPrefTap("大阪府")} />);
  expect(fake.map.fitBounds.mock.lastCall?.[1]).toMatchObject({
    duration: 450,
  });
});
test("a map created before its pins waits for them to install and to be ready", () => {
  const fake = fakeMapLibre();
  context.map = fake.maplibre;
  context.isLoaded = true;
  const waiting = {
    ...props(),
    pinsLoaded: false,
    pins: [],
    countPinsSource: [],
  };
  const view = render(<CardMap {...waiting} />);
  act(() => fake.emit("idle"));
  expect(fake.map.addSource).not.toHaveBeenCalled();
  expect(waiting.onReady).not.toHaveBeenCalled();
  const loaded = {
    ...waiting,
    pinsLoaded: true,
    pins: [pin],
    countPinsSource: [pin],
  };
  view.rerender(<CardMap {...loaded} />);
  expect(fake.sources.get("card-pins")?.setData).toHaveBeenLastCalledWith(
    pinsGeoJSON([pin]),
  );
  act(() => fake.emit("idle"));
  expect(loaded.onReady).toHaveBeenCalledTimes(1);
});
test("a map hidden behind another screen stops its camera and takes data only when shown", () => {
  const fake = fakeMapLibre();
  context.map = fake.maplibre;
  context.isLoaded = true;
  const initial = props();
  const view = render(
    <ScreenActivity value>
      <CardMap {...initial} />
    </ScreenActivity>,
  );
  const pins = fake.sources.get("card-pins")!.setData;
  const shown = pins.mock.calls.length;
  expect(fake.map.stop).not.toHaveBeenCalled();
  expect(fake.map.resize).not.toHaveBeenCalled();
  const selected = { ...initial, pins: [], selectedPins: [pin] };
  view.rerender(
    <ScreenActivity value={false}>
      <CardMap {...selected} />
    </ScreenActivity>,
  );
  expect(fake.map.stop).toHaveBeenCalledTimes(1);
  expect(pins).toHaveBeenCalledTimes(shown);
  expect(fake.map.fitBounds).not.toHaveBeenCalled();
  view.rerender(
    <ScreenActivity value>
      <CardMap {...selected} />
    </ScreenActivity>,
  );
  expect(fake.map.resize).toHaveBeenCalledTimes(1);
  expect(fake.map.triggerRepaint).toHaveBeenCalledTimes(1);
  expect(fake.map.resize.mock.invocationCallOrder[0]).toBeLessThan(
    fake.map.fitBounds.mock.invocationCallOrder[0],
  );
  expect(pins).toHaveBeenLastCalledWith(pinsGeoJSON([]));
  expect(fake.map.fitBounds).toHaveBeenCalledTimes(1);
});
test("a hidden map ignores the camera calls that reach its adapter late", () => {
  const fake = fakeMapLibre();
  context.map = fake.maplibre;
  context.isLoaded = true;
  const initial = props();
  const view = render(
    <ScreenActivity value>
      <CardMap {...initial} />
    </ScreenActivity>,
  );
  act(() => fake.emit("idle"));
  const adapter = vi.mocked(initial.onReady).mock.calls[0][0];
  view.rerender(
    <ScreenActivity value={false}>
      <CardMap {...initial} />
    </ScreenActivity>,
  );
  const current = fake.sources.get("card-current")!.setData;
  for (const call of [fake.map.easeTo, fake.map.fitBounds, current])
    call.mockClear();
  act(() => {
    adapter.locate(35, 139);
    adapter.select([pin]);
    adapter.focus(focusForPrefTap("東京都"));
  });
  expect(fake.map.easeTo).not.toHaveBeenCalled();
  expect(fake.map.fitBounds).not.toHaveBeenCalled();
  expect(current).not.toHaveBeenCalled();
  view.rerender(
    <ScreenActivity value>
      <CardMap {...initial} />
    </ScreenActivity>,
  );
  act(() => adapter.locate(35, 139));
  expect(fake.map.easeTo).toHaveBeenCalledTimes(1);
});
test("cleanup pairs every listener, ignores delayed borders and tolerates parent removal", async () => {
  const fake = fakeMapLibre();
  context.map = fake.maplibre;
  context.isLoaded = true;
  let finish!: (value: unknown) => void;
  vi.stubGlobal(
    "fetch",
    vi.fn(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    ),
  );
  const initial = props();
  const view = render(<CardMap {...initial} />);
  act(() => fake.emit("idle"));
  await act(async () => {});
  expect(fetch).toHaveBeenCalledTimes(1);
  const adapter = vi.mocked(initial.onReady).mock.calls[0][0];
  fake.remove();
  view.unmount();
  expect([...fake.listeners.values()].every((set) => set.size === 0)).toBe(
    true,
  );
  const additions = fake.map.addLayer.mock.calls.length;
  await act(async () => {
    finish({
      ok: true,
      json: async () => ({ type: "FeatureCollection", features: [] }),
    });
  });
  expect(fake.map.addLayer).toHaveBeenCalledTimes(additions);
  expect(fake.map.removeImage).not.toHaveBeenCalled();
  const moves = fake.map.fitBounds.mock.calls.length;
  adapter.select([pin]);
  adapter.focus(focusForPrefTap("東京都"));
  adapter.locate(35, 139);
  fake.emit("click", { point: { x: 0, y: 0 } });
  fake.emit("idle");
  expect(fake.map.fitBounds).toHaveBeenCalledTimes(moves);
  expect(initial.onDismiss).not.toHaveBeenCalled();
});
test("initial errors fail, late errors warn, and loading times out at 20 seconds", () => {
  vi.useFakeTimers();
  const fake = fakeMapLibre();
  context.map = fake.maplibre;
  const initial = props();
  const view = render(<CardMap {...initial} />);
  act(() => fake.emit("error", { error: Error("style failed") }));
  expect(initial.onError).toHaveBeenCalledWith("Error: style failed");
  view.unmount();
  const timed = props();
  const timerView = render(<CardMap {...timed} />);
  act(() => {
    vi.advanceTimersByTime(19999);
  });
  expect(timed.onError).not.toHaveBeenCalled();
  expect(fake.listeners.get("error")?.size).toBe(1);
  act(() => {
    vi.advanceTimersByTime(1);
  });
  expect(timed.onError).toHaveBeenCalledExactlyOnceWith(
    "地図の読み込みが時間内に完了しませんでした。",
  );
  // The map that failed is taken away, with its listeners.
  expect(fake.listeners.get("error")?.size).toBe(0);
  timerView.unmount();
  context.isLoaded = true;
  const loaded = props();
  render(<CardMap {...loaded} />);
  act(() => fake.emit("idle"));
  // A map that is ready has not timed out, however long it stays open.
  act(() => {
    vi.advanceTimersByTime(20000);
  });
  act(() => fake.emit("error", { error: Error("tile failed") }));
  // More failed tiles are the same news.
  act(() => fake.emit("error", { error: Error("tile failed again") }));
  expect(loaded.onWarning).toHaveBeenCalledExactlyOnceWith(
    "Error: tile failed",
  );
  expect(loaded.onError).not.toHaveBeenCalled();
});
test("a map that fails to load reports it once and is taken away", () => {
  const { fake, initial } = shown();
  expect(fake.listeners.get("error")?.size).toBe(1);
  // MapLibre's errors while the style loads, as mapcn's Map passes them on.
  act(() => {
    context.options.onError?.(Error("style failed"));
    context.options.onError?.(Error("sprite failed"));
  });
  expect(initial.onError).toHaveBeenCalledExactlyOnceWith(
    "Error: style failed",
  );
  expect(initial.onWarning).not.toHaveBeenCalled();
  expect([...fake.listeners.values()].every((set) => set.size === 0)).toBe(
    true,
  );
});
test("an error that is not an Error is told by its message", () => {
  expect(mapErrorText(Error("style failed"))).toBe("Error: style failed");
  expect(mapErrorText({ message: "style failed" })).toBe("style failed");
});
test("the map's listeners tell the callbacks of the latest render", () => {
  const { fake, initial, view } = shown();
  const latest = props();
  view.rerender(<CardMap {...latest} />);
  act(() => fake.emit("idle"));
  act(() => fake.emit("error", { error: Error("tile failed") }));
  tap(fake, 300, 300);
  expect(latest.onReady).toHaveBeenCalledOnce();
  expect(latest.onWarning).toHaveBeenCalledOnce();
  expect(latest.onDismiss).toHaveBeenCalledOnce();
  for (const callback of [
    initial.onReady,
    initial.onWarning,
    initial.onDismiss,
  ])
    expect(callback).not.toHaveBeenCalled();
});
test("a render that fails tells the onError given to that render", () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  context.map = fakeMapLibre().maplibre;
  const before = props();
  const view = render(<CardMap {...before} />);
  context.broken = true;
  const failing = props();
  view.rerender(<CardMap {...failing} />);
  expect(failing.onError).toHaveBeenCalledExactlyOnceWith(
    "Error: render failed",
  );
  expect(before.onError).not.toHaveBeenCalled();
});
test("changing focus or card data updates the badge count once", () => {
  const { fake, initial, view } = shown();
  const writes = fake.sources.get("card-level-counts")!.setData;
  const tokyoCount = (count: number) =>
    expect(writes.mock.lastCall?.[0].features).toContainEqual(
      expect.objectContaining({
        properties: expect.objectContaining({ id: "東京都", count }),
      }),
    );

  expect(writes).not.toHaveBeenCalled();
  const focused = { ...initial, focus: { area: "kanto", pref: null } };
  view.rerender(<CardMap {...focused} />);
  tokyoCount(1);
  const twoCards = [pin, { ...pin, id: "p2", cardIds: ["c2"] }];
  view.rerender(<CardMap {...focused} countPinsSource={twoCards} />);
  tokyoCount(2);
  view.rerender(<CardMap {...focused} countPinsSource={[]} />);
  tokyoCount(0);
  expect(writes).toHaveBeenCalledTimes(3);
});

test("disposal releases sources installed before a layer fails", () => {
  const fake = fakeMapLibre();
  const initial = props();
  const runtime = createMapRuntime(fake.maplibre, () => initial);
  fake.map.addLayer.mockImplementationOnce(() => {
    throw new Error("layer installation failed");
  });
  expect(() => runtime.initialize()).toThrow("layer installation failed");
  runtime.dispose();
  expect([...fake.sources.keys()]).toEqual([]);
  const retry = createMapRuntime(fake.maplibre, () => initial);
  retry.initialize();
  expect(retry.adapter).not.toBeNull();
  retry.dispose();
});

test("initialization and disposal are idempotent, including StrictMode remount", () => {
  const fake = fakeMapLibre();
  const initial = props();
  const runtime = createMapRuntime(fake.maplibre, () => initial);
  runtime.initialize();
  const additions = fake.map.addSource.mock.calls.length;
  runtime.initialize();
  expect(fake.map.addSource).toHaveBeenCalledTimes(additions);
  expect(runtime.adapter).not.toBeNull();
  runtime.dispose();
  const removals = fake.map.off.mock.calls.length;
  runtime.dispose();
  expect(fake.map.off).toHaveBeenCalledTimes(removals);
  expect(fake.sources.size).toBe(0);
  expect(runtime.adapter).toBeNull();
  runtime.sync({ ...initial, pins: [], countPinsSource: [] });
  context.map = fake.maplibre;
  context.isLoaded = true;
  const view = render(
    <StrictMode>
      <CardMap {...initial} />
    </StrictMode>,
  );
  act(() => {
    fake.emit("idle");
    fake.emit("click", { point: { x: 0, y: 0 } });
  });
  expect(initial.onReady).toHaveBeenCalledOnce();
  expect(initial.onDismiss).toHaveBeenCalledOnce();
  view.unmount();
  expect([...fake.listeners.values()].every((set) => set.size === 0)).toBe(
    true,
  );
});

test("focus after selection owns the camera, preserveCamera and app zooms keep navigation intact", () => {
  const fake = fakeMapLibre();
  context.map = fake.maplibre;
  context.isLoaded = true;
  const initial = props();
  const view = render(<CardMap {...initial} />);
  act(() => fake.emit("idle"));
  const next = {
    ...initial,
    selectedPins: [pin],
    focus: focusForPrefTap("東京都"),
  };
  const before = fake.map.fitBounds.mock.calls.length;
  view.rerender(<CardMap {...next} />);
  expect(fake.map.fitBounds).toHaveBeenCalledTimes(before + 2);
  expect(fake.map.fitBounds.mock.lastCall?.[0]).toEqual(
    focusCamera(next.focus, next.countPinsSource).bounds,
  );
  for (const call of fake.map.fitBounds.mock.calls)
    expect(call[2]).toEqual({ fromApp: true });
  fake.setZoom(8);
  act(() => fake.emit("zoom", { fromApp: true }));
  // By hand, but not past the pin zoom the prefecture needs.
  fake.setZoom(7.2);
  act(() => fake.emit("zoom", { originalEvent: {} }));
  fake.setZoom(6);
  act(() => fake.emit("zoom", { fromApp: true }));
  // A hand's event that does not shrink the view closes nothing.
  act(() => fake.emit("zoom", { originalEvent: {} }));
  expect(initial.onFocus).not.toHaveBeenCalled();
  fake.setZoom(5);
  act(() => fake.emit("zoom", { originalEvent: {} }));
  expect(vi.mocked(initial.onFocus).mock.calls).toEqual([
    [{ area: "kanto", pref: null, preserveCamera: true }],
  ]);
  // The closed level is drawn at once: no prefecture's pins below the pin zoom.
  expect(placeFilter(fake)).toBe(false);
  const moves = fake.map.fitBounds.mock.calls.length;
  // Until the owner takes up the closed level, its other changes do not
  // reopen the prefecture.
  view.rerender(<CardMap {...next} pins={[]} />);
  expect(fake.map.fitBounds).toHaveBeenCalledTimes(moves);
  view.rerender(
    <CardMap
      {...next}
      focus={{ area: null, pref: null, preserveCamera: true }}
    />,
  );
  expect(fake.map.fitBounds).toHaveBeenCalledTimes(moves);
});

test("border request starts after ready and uses the latest focus when it finishes", async () => {
  const fake = fakeMapLibre();
  context.map = fake.maplibre;
  context.isLoaded = true;
  let finish!: (value: unknown) => void;
  vi.stubGlobal(
    "fetch",
    vi.fn(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    ),
  );
  const initial = props();
  const view = render(<CardMap {...initial} />);
  expect(fetch).not.toHaveBeenCalled();
  act(() => fake.emit("idle"));
  expect(initial.onReady).toHaveBeenCalledOnce();
  await act(async () => {});
  expect(fetch).toHaveBeenCalledOnce();
  view.rerender(<CardMap {...initial} focus={focusForPrefTap("東京都")} />);
  await act(async () => {
    finish({
      ok: true,
      json: async () => ({ type: "FeatureCollection", features: [] }),
    });
  });
  expect(fake.sources.has("pref-border-lines")).toBe(true);
  expect(fake.map.setLayoutProperty).toHaveBeenCalledWith(
    "area-borders",
    "visibility",
    "none",
  );
  expect(fake.map.setPaintProperty).toHaveBeenCalledWith(
    "pref-borders",
    "line-opacity",
    1,
  );
  expect(initial.onError).not.toHaveBeenCalled();
  view.unmount();
  // Everything the app added is gone from the style.
  expect(fake.sources.size).toBe(0);
  expect(fake.layers.size).toBe(0);
  expect(fake.images.size).toBe(0);
});

test("a map taken away before its borders arrive neither asks for them nor draws them", async () => {
  const early = shown();
  act(() => early.fake.emit("idle"));
  early.view.unmount();
  await act(async () => {});
  expect(fetch).not.toHaveBeenCalled();
  let finish!: (value: unknown) => void;
  vi.stubGlobal(
    "fetch",
    vi.fn(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    ),
  );
  const late = shown();
  act(() => late.fake.emit("idle"));
  await act(async () => {});
  expect(fetch).toHaveBeenCalledOnce();
  late.view.unmount();
  await act(async () => {
    finish({
      ok: true,
      json: async () => ({ type: "FeatureCollection", features: [] }),
    });
  });
  expect(late.fake.sources.size).toBe(0);
  expect(late.fake.layers.size).toBe(0);
});

test("style readiness changes release the old registration before registering again", () => {
  const fake = fakeMapLibre();
  context.map = fake.maplibre;
  context.isLoaded = true;
  const initial = props();
  const view = render(<CardMap {...initial} />);
  act(() => fake.emit("idle"));
  const additions = fake.map.addSource.mock.calls.length;
  context.isLoaded = false;
  view.rerender(<CardMap {...initial} />);
  expect(fake.sources.size).toBe(0);
  expect(fake.layers.size).toBe(0);
  expect(fake.images.size).toBe(0);
  context.isLoaded = true;
  view.rerender(<CardMap {...initial} />);
  expect(fake.map.addSource).toHaveBeenCalledTimes(additions * 2);
  // The owner hears of the first readiness only.
  act(() => fake.emit("idle"));
  expect(initial.onReady).toHaveBeenCalledOnce();
});

// mapcn reads `styles.light ?? its default`: an empty URL must not reach it.
test.each([
  [
    { MODE: "fixture" },
    { styles: { light: "/map-style.json", dark: "/map-style.json" } },
  ],
  [
    {
      MODE: "production",
      VITE_MAP_STYLE_URL: "https://basemap.example/style.json",
    },
    {
      styles: {
        light: "https://basemap.example/style.json",
        dark: "https://basemap.example/style.json",
      },
    },
  ],
  [{ MODE: "production", VITE_MAP_STYLE_URL: "" }, {}],
  [{ MODE: "production" }, {}],
])("the build %o loads the basemap %o", (env, expected) => {
  expect(mapStyles(env)).toEqual(expected);
});

test("E1 starts from national bounds instead of a fixed zoom", () => {
  const fake = fakeMapLibre();
  context.map = fake.maplibre;
  render(<CardMap {...props()} />);
  expect(context.options.attributionControl).toEqual({
    compact: false,
  });
  expect(context.options.zoom).toBeUndefined();
  // Measured from the container as the map is created: a phone's width.
  const created = context.options.createOptions?.(
    fake.maplibre.getContainer() as HTMLDivElement,
  );
  expect(created?.bounds).toEqual(
    focusCamera({ area: null, pref: null }).bounds,
  );
  expect(created?.fitBoundsOptions).toMatchObject({
    padding: { top: 72, left: 8, right: 8, bottom: 16 },
  });
});

test("the provider's style is recoloured as it arrives, before MapLibre loads it", () => {
  context.map = fakeMapLibre().maplibre;
  render(<CardMap {...props()} />);
  const style: StyleSpecification = {
    version: 8,
    sources: {},
    layers: [{ id: "land", type: "background" }],
  };
  expect(
    context.options.transformStyle?.(undefined, style).layers[0].paint,
  ).toEqual({ "background-color": mapPalette(false).land });
});

// The pages send no referrer (SE-1); the basemap's key allows the site's
// hosts, so its requests keep what the browser sent before.
test("basemap requests send the site's origin under the page's no-referrer", () => {
  const fake = fakeMapLibre();
  context.map = fake.maplibre;
  render(<CardMap {...props()} />);
  expect(
    context.options.transformRequest?.(
      "https://tiles.basemaps.cartocdn.com/vectortiles/1/2/3.mvt",
    ),
  ).toEqual({
    url: "https://tiles.basemaps.cartocdn.com/vectortiles/1/2/3.mvt",
    referrerPolicy: "strict-origin-when-cross-origin",
  });
});

// The style is transformed as it arrives; the OS may change before the map is
// set up over it.
test.each([
  [false, false],
  [true, true],
  [true, false],
  [false, true],
])(
  "OS changes repaint the basemap, the app's layers and the pins in place, and back (style dark=%s, initial dark=%s)",
  async (styleDark, initialDark) => {
    let listener = () => {};
    const media = {
      matches: initialDark,
      addEventListener: vi.fn((_event, fn) => {
        listener = fn;
      }),
      removeEventListener: vi.fn(),
    };
    vi.stubGlobal("matchMedia", () => media);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({ type: "FeatureCollection", features: [] }),
      ),
    );
    // The provider's style as the transform made it for the scheme then.
    const style: StyleSpecification = {
      version: 8,
      sources: {},
      layers: [
        { id: "land", type: "background" },
        {
          id: "boundary_state",
          type: "line",
          source: "v",
          "source-layer": "boundaries",
          paint: { "line-color": "#ead5d7" },
        },
      ],
    };
    const fake = fakeMapLibre({
      zoom: 8,
      basemap: transformBasemapStyle(style, styleDark).layers,
    });
    const initial = {
      ...props(),
      selectedPins: [pin],
      focus: focusForPrefTap("東京都"),
    };
    const runtime = createMapRuntime(fake.maplibre, () => initial);
    runtime.initialize();
    fake.emit("idle");
    await vi.waitFor(() => expect(fake.layers.has("pref-borders")).toBe(true));
    const moves = fake.map.fitBounds.mock.calls.length;
    const lineColor = (id: string) =>
      fake.layer("line", id).paint?.["line-color"];
    const painted = () => ({
      land: fake.layer("background", "land").paint?.["background-color"],
      border: lineColor("boundary_state"),
      paleBorder: lineColor("pref-borders-basemap-low"),
      ownBorders: [lineColor("pref-borders"), lineColor("area-borders")],
      counts: fake.layer("circle", "card-level-counts").paint?.["circle-color"],
      others: fake.layer("symbol", "card-pins-place").paint?.["icon-opacity"],
      pins: ["card-pins", "card-selected"].map(
        (id) =>
          fake.sources.get(id)!.setData.mock.lastCall?.[0].features[0]
            .properties.color,
      ),
    });
    const expected = (dark: boolean) => {
      const palette = mapPalette(dark);
      return {
        land: palette.land,
        border: palette.boundary,
        // Below the pin zoom the provider's own border is as pale as it came.
        paleBorder: dark ? palette.boundary : "#ead5d7",
        ownBorders: [palette.boundary, palette.boundary],
        counts: palette.iron,
        others: [
          "case",
          ["==", ["get", "pref"], "東京都"],
          1,
          palette.inactivePinOpacity,
        ],
        pins: [palette.pins.active, palette.pins.active],
      };
    };
    // No pins were sent yet: the sources were created with them.
    expect({ ...painted(), pins: null }).toEqual({
      ...expected(initialDark),
      pins: null,
    });
    media.matches = !initialDark;
    listener();
    expect(painted()).toEqual(expected(!initialDark));
    expect(fake.map.updateImage).toHaveBeenCalledTimes(5);
    media.matches = initialDark;
    listener();
    expect(painted()).toEqual(expected(initialDark));
    expect(fake.map.fitBounds).toHaveBeenCalledTimes(moves);
    expect(fake.sources.size).toBe(6);
    runtime.dispose();
    expect(media.removeEventListener).toHaveBeenCalledWith("change", listener);
  },
);

test("reconciles a theme change between the style transform and runtime initialization", () => {
  // The provider's dark background, from a style transformed before the change.
  const fake = fakeMapLibre({
    basemap: [
      {
        id: "background",
        type: "background",
        paint: { "background-color": "#202723" },
      },
    ],
  });
  const initial = props();
  const runtime = createMapRuntime(fake.maplibre, () => initial);
  runtime.initialize();
  expect(fake.map.setPaintProperty).toHaveBeenCalledWith(
    "background",
    "background-color",
    "#efede8",
  );
  runtime.dispose();
});

test("national camera uses map width and counts refresh across 600px on resize", () => {
  const fake = fakeMapLibre();
  context.map = fake.maplibre;
  context.isLoaded = true;
  const initial = props();
  render(<CardMap {...initial} />);
  act(() => fake.emit("idle"));
  expect(fake.map.fitBounds.mock.lastCall?.[1].padding).toEqual({
    left: 8,
    right: 8,
    top: 72,
    bottom: 16,
  });
  fake.setSize(1440, 900);
  act(() => fake.emit("resize"));
  expect(
    fake.sources
      .get("card-level-counts")
      ?.setData.mock.lastCall?.[0].features.every(
        (f: { properties: { valueSize: number } }) =>
          f.properties.valueSize === 13,
      ),
  ).toBe(true);
  const sizes = (width: number) => {
    fake.setSize(width, 915);
    act(() => fake.emit("resize"));
    return [
      ...new Set(
        fake.sources
          .get("card-level-counts")
          ?.setData.mock.lastCall?.[0].features.map(
            (f: { properties: { valueSize: number } }) =>
              f.properties.valueSize,
          ),
      ),
    ];
  };
  expect(sizes(412)).toEqual([11]);
  expect(sizes(600)).toEqual([13]);
  expect(sizes(599)).toEqual([11]);
});

test("keeps the camera over Japan and follows the viewport for the zoom-out limit", () => {
  const fake = fakeMapLibre();
  const runtime = createMapRuntime(fake.maplibre, () => props());
  runtime.initialize();
  expect(fake.map.setTransformConstrain).toHaveBeenCalledWith(
    expect.any(Function),
  );
  const phone = fake.map.setMinZoom.mock.lastCall![0];
  fake.setSize(1440, 900);
  fake.emit("resize");
  expect(fake.map.setMinZoom.mock.lastCall![0]).toBeGreaterThan(phone);
  // A map without a size, hidden for now, keeps the limit it had.
  for (const [width, height] of [
    [0, 900],
    [1440, 0],
  ]) {
    fake.setSize(width, height);
    fake.emit("resize");
  }
  expect(fake.map.setMinZoom).toHaveBeenCalledTimes(2);
  runtime.dispose();
});

test("updates after the map's sources are gone do nothing instead of throwing", () => {
  const fake = fakeMapLibre();
  const initial = props();
  const runtime = createMapRuntime(fake.maplibre, () => initial);
  runtime.initialize();
  runtime.sync(initial);
  fake.emit("idle");
  const adapter = runtime.adapter!;
  fake.sources.clear();
  const other = { ...pin, id: "q", cardIds: ["d"] };
  expect(() => {
    runtime.sync({ ...initial, pins: [other], selectedPins: [other] });
    adapter.select([pin]);
    adapter.locate(35, 139);
  }).not.toThrow();
  // A runtime is on the screen unless it is told it is hidden.
  expect(fake.map.easeTo).toHaveBeenCalledTimes(1);
  runtime.dispose();
});

test.each([
  [112, 100, true],
  [88, 100, true],
  [100, 112, true],
  [100, 88, true],
  [113, 100, false],
  [87, 100, false],
  [100, 113, false],
  [100, 87, false],
])(
  "a tap at 100,100 reaches a pin up to 12px away (pin at %i,%i: %s), without zooming",
  (x, y, selected) => {
    const { fake, initial } = shown();
    fake.draw("card-pins-place", [pinAt(x, y)]);
    tap(fake, 100, 100);
    expect(vi.mocked(initial.onSelect).mock.calls).toEqual(
      selected ? [[["c"], "p"]] : [],
    );
    expect(initial.onDismiss).toHaveBeenCalledTimes(selected ? 0 : 1);
    expect(fake.map.easeTo).not.toHaveBeenCalled();
  },
);

test("a tap selects the nearest of the pins around it, lid or facility, selected or not", () => {
  const { fake, initial } = shown();
  fake.draw("card-pins-place", [pinAt(98, 100, "west", ["w"])]);
  fake.draw("card-selected-place", [pinAt(100, 103, "south", ["s"])]);
  fake.draw("card-pins-lid", [pinAt(101, 101, "near", ["a", "b"])]);
  // Not a pin layer: the user's own position is not a card.
  fake.draw("card-current-location", [pinAt(100, 100, "here")]);
  tap(fake, 100, 100);
  expect(initial.onSelect).toHaveBeenCalledExactlyOnceWith(["a", "b"], "near");
  expect(initial.onDismiss).not.toHaveBeenCalled();
});

test("a tap on only unreadable pins dismisses, and the pointer shows what a tap would act on", () => {
  const { fake, initial } = shown();
  fake.draw("card-pins-place", [pinAt(100, 100)], 10);
  fake.draw("card-pins-place", [
    at(200, 100, { id: "empty", cardIds: "[]" }),
    at(200, 100, { id: 7, cardIds: '["c"]' }),
  ]);
  fake.draw("card-level-counts", [badge(300, 100, "area", "kanto")], 16);
  fake.draw("card-current-location", [pinAt(500, 100, "here")], 8);
  tap(fake, 200, 100);
  expect(initial.onSelect).not.toHaveBeenCalled();
  expect(initial.onDismiss).toHaveBeenCalledTimes(1);
  const cursor = (x: number, y: number) => {
    act(() => fake.emit("mousemove", { point: { x, y } }));
    return fake.maplibre.getCanvas().style.cursor;
  };
  expect(cursor(105, 100)).toBe("pointer");
  expect(cursor(200, 100)).toBe("");
  expect(cursor(310, 100)).toBe("pointer");
  expect(cursor(500, 100)).toBe("");
  expect(cursor(400, 400)).toBe("");
});

test("a badge of an unknown kind is not focused, and the pin behind it is selected", () => {
  const { fake, initial } = shown();
  fake.draw("card-level-counts", [badge(100, 100, "city", "東京都")], 16);
  fake.draw("card-pins-place", [pinAt(100, 100)]);
  tap(fake, 100, 100);
  expect(initial.onFocus).not.toHaveBeenCalled();
  expect(initial.onSelect).toHaveBeenCalledExactlyOnceWith(["c"], "p");
});

// National badges are small and close together: a tap near one counts.
test.each([
  [78, 100, true],
  [122, 100, true],
  [100, 78, true],
  [100, 122, true],
  [77.9, 100, false],
  [100, 122.1, false],
  // In the 22px box around the tap, but farther than 22px from it.
  [117, 117, false],
])(
  "a national tap at 100,100 reaches a badge centred up to 22px away (badge at %d,%d: %s)",
  (x, y, focused) => {
    const { fake, initial } = shown();
    fake.draw("card-level-counts", [badge(x, y, "area", "chubu")], 16);
    // Only count badges are read: another layer's feature of the same shape,
    // as a basemap may have, is not one.
    fake.draw("card-pins-place", [badge(100, 100, "area", "kanto")], 16);
    tap(fake, 100, 100);
    expect(vi.mocked(initial.onFocus).mock.calls).toEqual(
      focused ? [[{ area: "chubu", pref: null }]] : [],
    );
  },
);

test("a national tap takes the nearest badge, the topmost of equals, or the label under the finger", () => {
  const { fake, initial } = shown();
  const chubu = badge(80, 100, "area", "chubu");
  fake.draw("card-level-counts", [chubu, badge(121, 100, "area", "kanto")], 16);
  fake.draw("card-count-names-area", [chubu], 45);
  const focusedBy = (x: number, y: number) => {
    vi.mocked(initial.onFocus).mockClear();
    tap(fake, x, y);
    return vi.mocked(initial.onFocus).mock.calls.map(([focus]) => focus.area);
  };
  expect(focusedBy(102, 100)).toEqual(["kanto"]);
  // Half way between the two: the one drawn on top.
  expect(focusedBy(100.5, 100)).toEqual(["chubu"]);
  // Beyond the circle, on the name beside it.
  expect(focusedBy(40, 100)).toEqual(["chubu"]);
  // On a wide circle's rim, more than 22px from its centre, and on no name.
  fake.draw("card-level-counts", [badge(330, 300, "area", "kinki")], 26);
  expect(focusedBy(305, 300)).toEqual([]);
});

// Below the national level a badge is as large as it is drawn.
test.each([
  [6, { area: null, pref: null }],
  [5.6, { area: null, pref: null }],
  [5, { area: "kanto", pref: null }],
])(
  "a tap on a prefecture badge's rim opens the prefecture (zoom %d, focus %o)",
  (zoom, focus) => {
    const { fake, initial } = shown({ zoom }, { focus });
    fake.draw("card-level-counts", [badge(330, 300, "pref", "東京都")], 26);
    tap(fake, 305, 300);
    expect(initial.onFocus).toHaveBeenCalledExactlyOnceWith({
      area: "kanto",
      pref: "東京都",
    });
    tap(fake, 303, 300);
    // Only the circle opens it: its name is not a target.
    fake.draw("card-count-names-pref", [badge(500, 300, "pref", "大阪府")], 30);
    tap(fake, 500, 300);
    expect(initial.onFocus).toHaveBeenCalledTimes(1);
  },
);

test("a style without glyphs has no badge names, and a tap or the pointer on it is not a map error", () => {
  const { fake, initial } = shown({ glyphs: false });
  act(() => fake.emit("idle"));
  tap(fake, 300, 300);
  act(() => fake.emit("mousemove", { point: { x: 300, y: 300 } }));
  expect(fake.errors).toEqual([]);
  expect(initial.onWarning).not.toHaveBeenCalled();
  expect(initial.onDismiss).toHaveBeenCalledTimes(1);
});

test("a selection moves the camera to its pins and pulses the ring once, however often it changes", () => {
  const { fake, initial, view } = shown();
  // Handed over: the map no longer watches its frames for the first pins.
  act(() => fake.emit("idle"));
  const other = { ...pin, id: "q", lat: 34.7, lng: 141.5 };
  const south = { ...pin, id: "r", lat: 33.2, lng: 140.1 };
  view.rerender(<CardMap {...initial} selectedPins={[pin]} />);
  view.rerender(<CardMap {...initial} selectedPins={[other, pin, south]} />);
  expect(fake.map.fitBounds.mock.lastCall?.slice(0, 2)).toEqual([
    [
      [139.7, 33.2],
      [141.5, 35.6],
    ],
    expect.objectContaining({ maxZoom: 15, duration: 450 }),
  ]);
  const radii = () =>
    ["card-selection-ring", "card-selection-outer"].map(
      (id) => fake.layer("circle", id).paint?.["circle-radius"],
    );
  expect(radii()).toEqual([24, 27]);
  expect(fake.listeners.get("render")?.size).toBe(1);
  act(() => fake.emit("render"));
  expect(radii()).toEqual([18, 21]);
  // Taken away mid-pulse, the map keeps no listener.
  view.rerender(<CardMap {...initial} selectedPins={[pin]} />);
  expect(fake.listeners.get("render")?.size).toBe(1);
  view.unmount();
  expect([...fake.listeners.values()].every((set) => set.size === 0)).toBe(
    true,
  );
});

test("with reduced motion the camera jumps and the ring does not pulse", () => {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query === "(prefers-reduced-motion: reduce)",
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  const { fake, initial, view } = shown();
  act(() => fake.emit("idle"));
  view.rerender(<CardMap {...initial} selectedPins={[pin]} />);
  expect(fake.map.fitBounds.mock.lastCall?.[1]).toMatchObject({ duration: 0 });
  expect(
    fake.layer("circle", "card-selection-ring").paint?.["circle-radius"],
  ).toBe(18);
  expect(fake.listeners.get("render")?.size ?? 0).toBe(0);
  act(() => vi.mocked(initial.onReady).mock.calls[0][0].locate(35, 139));
  expect(fake.map.easeTo.mock.lastCall?.[0]).toEqual({
    center: [139, 35],
    zoom: 14,
    duration: 0,
  });
  expect(fake.sources.get("card-current")!.setData).toHaveBeenLastCalledWith({
    type: "Feature",
    properties: {},
    geometry: { type: "Point", coordinates: [139, 35] },
  });
});

test("counts follow the level: redrawn when the zoom crosses to prefectures or to pins, not within a level", () => {
  const { fake } = shown();
  const counts = fake.sources.get("card-level-counts")!.setData;
  const drawnAt = (zoom: number) => {
    fake.setZoom(zoom);
    act(() => fake.emit("zoom", { fromApp: true }));
    return [
      counts.mock.calls.length,
      counts.mock.lastCall?.[0].features.length,
    ];
  };
  expect(drawnAt(5.5)).toEqual([0, undefined]);
  expect(drawnAt(5.6)).toEqual([1, 47]);
  expect(drawnAt(6.9)).toEqual([1, 47]);
  expect(drawnAt(7)).toEqual([2, 0]);
  expect(drawnAt(18)).toEqual([2, 0]);
  expect(drawnAt(4)).toEqual([3, 9]);
});

test("pins are sent to the map when they change, not on every render", () => {
  const { fake, initial, view } = shown();
  const pins = fake.sources.get("card-pins")!.setData;
  const sent = pins.mock.calls.length;
  view.rerender(<CardMap {...initial} onSelect={vi.fn()} />);
  expect(pins).toHaveBeenCalledTimes(sent);
  view.rerender(<CardMap {...initial} pins={[]} />);
  expect(pins).toHaveBeenCalledTimes(sent + 1);
  expect(pins).toHaveBeenLastCalledWith(pinsGeoJSON([]));
});

test("pins below their zoom are hidden from the start, and with a prefecture open the others step back", () => {
  const nation = fakeMapLibre();
  createMapRuntime(nation.maplibre, () => props()).initialize();
  expect(nation.map.setFilter).toHaveBeenCalledWith("card-pins-place", false);
  expect(nation.map.setFilter).toHaveBeenCalledWith("card-pins-lid", false);
  const { fake } = shown({ zoom: 7 }, { focus: focusForPrefTap("東京都") });
  const opacities = () => [
    fake.layer("symbol", "card-pins-place").paint?.["icon-opacity"],
    fake.layer("circle", "card-pins-lid").paint?.["circle-opacity"],
    fake.layer("circle", "card-pins-lid").paint?.["circle-stroke-opacity"],
  ];
  const others = [
    "case",
    ["==", ["get", "pref"], "東京都"],
    1,
    mapPalette(false).inactivePinOpacity,
  ];
  expect(opacities()).toEqual([others, others, others]);
  // Below the pin zoom only the open prefecture's pins are drawn at all.
  fake.setZoom(6.99);
  act(() => fake.emit("zoom", { fromApp: true }));
  expect(opacities()).toEqual([1, 1, 1]);
});

test("with accounts, receipt marks follow their pins, and a receipt change redraws the selection in place", () => {
  vi.stubEnv("VITE_ACCOUNTS_ENABLED", "true");
  const focus = focusForPrefTap("東京都");
  const { fake, initial, view } = shown(
    { zoom: 8 },
    { focus, selectedPins: [pin] },
  );
  const receipts = fake.layer("symbol", "card-pins-receipt");
  expect(receipts.paint?.["icon-opacity"]).toEqual(
    fake.layer("symbol", "card-pins-place").paint?.["icon-opacity"],
  );
  expect(receipts.paint?.["icon-opacity"]).not.toBe(1);
  expect(fake.map.setFilter).toHaveBeenCalledWith("card-pins-receipt", [
    "all",
    pinFilter(8, focus, "place"),
    ["in", ["get", "receipt"], ["literal", ["all", "some"]]],
  ]);
  expect(fake.layers.has("card-selected-receipt")).toBe(true);
  const selected = fake.sources.get("card-selected")!.setData;
  const moves = fake.map.fitBounds.mock.calls.length;
  const received = { ...pin, receipt: "all" as const };
  view.rerender(<CardMap {...initial} selectedPins={[received]} />);
  expect(selected).toHaveBeenLastCalledWith(pinsGeoJSON([received]));
  expect(fake.map.fitBounds).toHaveBeenCalledTimes(moves);
  // Other pins, or more of them, are a new selection: the camera goes there.
  view.rerender(<CardMap {...initial} selectedPins={[{ ...pin, id: "q" }]} />);
  expect(fake.map.fitBounds).toHaveBeenCalledTimes(moves + 1);
  view.rerender(
    <CardMap
      {...initial}
      selectedPins={[
        { ...pin, id: "q" },
        { ...pin, id: "r" },
      ]}
    />,
  );
  expect(fake.map.fitBounds).toHaveBeenCalledTimes(moves + 2);
  // As many pins, but not the same ones.
  view.rerender(
    <CardMap
      {...initial}
      selectedPins={[
        { ...pin, id: "q" },
        { ...pin, id: "s" },
      ]}
    />,
  );
  expect(fake.map.fitBounds).toHaveBeenCalledTimes(moves + 3);
  view.unmount();
  expect(fake.layers.size).toBe(0);
  expect(fake.images.size).toBe(0);
});

// scripts/perf drives the drawn map through these.
test("the measurement scripts get the view, and a point to tap where the canvas shows a pin or badge", () => {
  const { fake, initial } = shown();
  act(() => fake.emit("idle"));
  const adapter = vi.mocked(initial.onReady).mock.calls[0][0];
  expect(adapter.diagnostics!.view()).toEqual({ lat: 35, lng: 139, zoom: 4 });
  fake.draw("card-current-location", [pinAt(5, 5, "here")]);
  fake.draw("card-pins-place", [
    at(10, 20, { id: "unreadable", cardIds: "[]" }),
    pinAt(50, 60, "covered"),
    pinAt(150, 160, "p"),
  ]);
  fake.draw("card-level-counts", [badge(250, 260, "area", "kanto")], 16);
  // A panel lies over the first pin.
  const canvas = fake.maplibre.getCanvas();
  // The map starts below a header: the page's points are the map's, moved.
  canvas.getBoundingClientRect = () => new DOMRect(10, 20, 412, 823);
  const elementFromPoint = vi.fn((x: number, _y: number) =>
    x === 60 ? document.body : canvas,
  );
  Object.assign(document, { elementFromPoint });
  try {
    expect(adapter.diagnostics!.tapPoint()).toEqual({ x: 150, y: 160 });
    expect(elementFromPoint).toHaveBeenLastCalledWith(160, 180);
    expect(adapter.diagnostics!.tapPoint("covered")).toBeNull();
    expect(adapter.diagnostics!.tapPoint("kanto")).toEqual({ x: 250, y: 260 });
    expect(adapter.diagnostics!.tapPoint("missing")).toBeNull();
  } finally {
    Reflect.deleteProperty(document, "elementFromPoint");
  }
});

test("a level reached by zooming out is measured when it is next zoomed out", () => {
  const { fake, initial } = shown(
    { zoom: 8 },
    { focus: focusForPrefTap("東京都") },
  );
  act(() => fake.emit("idle"));
  const zoomOutTo = (zoom: number) => {
    fake.setZoom(zoom);
    act(() => fake.emit("zoom", { originalEvent: {} }));
    return vi.mocked(initial.onFocus).mock.lastCall?.[0];
  };
  // The prefecture opened at zoom 8: below the pin zoom it closes.
  expect(zoomOutTo(6)).toMatchObject({ area: "kanto", pref: null });
  // The area was not fitted by the app. Its own view fits at zoom 5.2 here,
  // so it stays open until clearly smaller than that.
  fake.setFitZoom(5.2);
  expect(zoomOutTo(4.9)).toMatchObject({ area: "kanto" });
  expect(zoomOutTo(4.6)).toEqual({
    area: null,
    pref: null,
    preserveCamera: true,
  });
});

test("the map is ready once its pins are in, and fits its level only then", () => {
  const fake = fakeMapLibre();
  fake.setSourcesLoaded(false);
  context.map = fake.maplibre;
  context.isLoaded = true;
  const initial = props();
  render(<CardMap {...initial} />);
  act(() => fake.emit("idle"));
  expect(initial.onReady).not.toHaveBeenCalled();
  expect(fake.map.fitBounds).not.toHaveBeenCalled();
  fake.setSourcesLoaded(true);
  act(() => {
    fake.emit("idle");
    fake.emit("idle");
  });
  expect(initial.onReady).toHaveBeenCalledOnce();
  // A later rest of the map does not pull the camera back.
  expect(fake.map.fitBounds).toHaveBeenCalledTimes(1);
});

test("a focus the owner sets through the drawn map is shown at once", () => {
  const { fake, initial } = shown();
  act(() => fake.emit("idle"));
  const adapter = vi.mocked(initial.onReady).mock.calls[0][0];
  const tokyo = focusForPrefTap("東京都");
  act(() => adapter.focus(tokyo));
  expect(placeFilter(fake)).toEqual(pinFilter(4, tokyo, "place"));
  expect(fake.map.fitBounds.mock.lastCall?.[0]).toEqual(
    focusCamera(tokyo, initial.countPinsSource).bounds,
  );
});

test("a render that fails after the map was ready still fails the map", () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  const { fake, initial, view } = shown();
  act(() => fake.emit("idle"));
  context.broken = true;
  view.rerender(<CardMap {...initial} />);
  expect(initial.onError).toHaveBeenCalledExactlyOnceWith(
    "Error: render failed",
  );
  expect(initial.onWarning).not.toHaveBeenCalled();
});

test("the measurement scripts' exercise pans and zooms six times, half a second apart, until the map goes away", async () => {
  vi.useFakeTimers();
  const { fake, initial, view } = shown();
  act(() => fake.emit("idle"));
  const adapter = vi.mocked(initial.onReady).mock.calls[0][0];
  const whole = adapter.diagnostics!.exercise();
  await vi.advanceTimersByTimeAsync(6000);
  await whole;
  expect(fake.map.jumpTo).toHaveBeenCalledExactlyOnceWith({
    center: [139.76, 35.68],
    zoom: 7,
  });
  const moving = { duration: 450 };
  expect(fake.map.panBy.mock.calls).toEqual(
    [-80, 80, -80, 80, -80, 80].map((x) => [[x, 30], moving]),
  );
  expect(fake.map.zoomTo.mock.calls).toEqual(
    [8, 7, 8, 7, 8, 7].map((zoom) => [zoom, moving]),
  );
  for (const move of [fake.map.panBy, fake.map.zoomTo]) move.mockClear();
  // Taken away after the second pan, it moves no more.
  const cut = adapter.diagnostics!.exercise();
  await vi.advanceTimersByTimeAsync(1100);
  view.unmount();
  await vi.advanceTimersByTimeAsync(6000);
  await cut;
  expect(fake.map.panBy).toHaveBeenCalledTimes(2);
  expect(fake.map.zoomTo).toHaveBeenCalledTimes(1);
});

test("a theme change before the borders arrive, on a style without a state border, is not a map error", () => {
  let listener = () => {};
  const media = {
    matches: false,
    addEventListener: vi.fn((_event, fn) => {
      listener = fn;
    }),
    removeEventListener: vi.fn(),
  };
  vi.stubGlobal("matchMedia", () => media);
  const fake = fakeMapLibre();
  const runtime = createMapRuntime(fake.maplibre, () => props());
  runtime.initialize();
  media.matches = true;
  listener();
  expect(fake.errors).toEqual([]);
  expect(
    fake.layer("circle", "card-level-counts").paint?.["circle-color"],
  ).toBe(mapPalette(true).iron);
  runtime.dispose();
});

test("the map takes away only what it added, whatever the style's own layers and images are named", () => {
  // Any name the app does not add, such as the one mutation testing puts in
  // the app's lists, stays with the style.
  const foreign = "Stryker was here!";
  const fake = fakeMapLibre({
    basemap: [
      { id: "land", type: "background" },
      { id: foreign, type: "background" },
    ],
  });
  fake.images.set(foreign, { width: 1, height: 1, data: new Uint8Array(4) });
  const runtime = createMapRuntime(fake.maplibre, () => props());
  runtime.initialize();
  expect(fake.layers.size).toBeGreaterThan(2);
  expect(fake.images.size).toBeGreaterThan(1);
  runtime.dispose();
  expect([...fake.layers.keys()]).toEqual(["land", foreign]);
  expect([...fake.images.keys()]).toEqual([foreign]);
  expect(fake.errors).toEqual([]);
});

test("an image the style has lost meanwhile is not removed again when the map goes away", () => {
  const { fake, view } = shown();
  // As a style update that drops the app's images does.
  fake.maplibre.removeImage("card-square-active");
  view.unmount();
  expect(fake.errors).toEqual([]);
  expect(fake.images.size).toBe(0);
});
