import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { StrictMode, type ReactNode } from "react";
import { createMapRuntime } from "./map-runtime";
import type { Map as MapLibreMap } from "maplibre-gl";
import CardMap, { selectionPadding, type CardMapProps } from "./card-map";
import { countPins, focusForPrefTap, focusCamera } from "./map-levels";
import { pinsGeoJSON } from "./mapcn-data";
import { ScreenActivity } from "../../shared/browser/screen-activity";
import type { Pin } from "../../domain/types";
const context = vi.hoisted(() => ({
  map: null as MapLibreMap | null,
  isLoaded: false,
  options: {} as Record<string, unknown>,
}));
vi.mock("../../components/ui/map", () => ({
  Map: ({ children, ...options }: { children: ReactNode }) => {
    context.options = options;
    return children;
  },
  MapControls: () => null,
  useMap: () => context,
}));
vi.mock("./map-levels", async (original) => {
  const module = await original<typeof import("./map-levels")>();
  return { ...module, countPins: vi.fn(module.countPins) };
});
vi.mock("../../shared/browser/painted", () => ({
  painted: () => Promise.resolve(),
}));
function fakeMap() {
  const listeners = new Map<string, Set<(event: never) => void>>();
  const sources = new Map<string, { setData: ReturnType<typeof vi.fn> }>();
  const layers = new Map<string, { id: string }>();
  const images = new Set<string>();
  const container = document.createElement("div");
  container.getBoundingClientRect = () => new DOMRect(0, 0, 412, 823);
  let removed = false;
  let zoom = 4;
  const map = {
    on: vi.fn((name: string, fn: (event: never) => void) => {
      if (!listeners.has(name)) listeners.set(name, new Set());
      listeners.get(name)!.add(fn);
    }),
    off: vi.fn((name: string, fn: (event: never) => void) => {
      listeners.get(name)?.delete(fn);
    }),
    addSource: vi.fn((id: string) => {
      if (sources.has(id)) throw Error("duplicate source");
      sources.set(id, { setData: vi.fn() });
    }),
    getSource: (id: string) => sources.get(id),
    removeSource: vi.fn((id: string) => sources.delete(id)),
    addLayer: vi.fn((layer: { id: string }) => {
      if (layers.has(layer.id)) throw Error("duplicate layer");
      layers.set(layer.id, layer);
    }),
    getLayer: (id: string) => layers.get(id),
    removeLayer: vi.fn((id: string) => layers.delete(id)),
    getStyle: () =>
      removed ? undefined : { layers: [...layers.values()], glyphs: "glyphs" },
    hasImage: (id: string) => images.has(id),
    addImage: vi.fn((id: string) => images.add(id)),
    updateImage: vi.fn(),
    removeImage: vi.fn((id: string) => images.delete(id)),
    setFilter: vi.fn(),
    setPaintProperty: vi.fn(),
    setLayoutProperty: vi.fn(),
    setLayerZoomRange: vi.fn(),
    getZoom: () => zoom,
    getContainer: () => container,
    cameraForBounds: () => ({ zoom: 8 }),
    fitBounds: vi.fn(),
    easeTo: vi.fn(),
    project: ([x, y]: [number, number]) => ({ x, y }),
    getCenter: () => ({ lat: 35, lng: 139 }),
    getCanvas: () => container,
    queryRenderedFeatures: vi.fn(() => []),
    isSourceLoaded: () => true,
    stop: vi.fn(),
    resize: vi.fn(),
    triggerRepaint: vi.fn(),
  };
  return {
    map,
    sources,
    listeners,
    emit(name: string, event = {}) {
      for (const fn of listeners.get(name) ?? [])
        fn({ type: name, ...event } as never);
    },
    setZoom(value: number) {
      zoom = value;
    },
    remove() {
      removed = true;
      sources.clear();
      layers.clear();
      images.clear();
    },
  };
}
const pin = {
  id: "p",
  cardIds: ["c"],
  lat: 35.6,
  lng: 139.7,
  pref: "東京都",
  kind: "place",
  status: "active",
} satisfies Pin;
function props(): CardMapProps {
  return {
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
  vi.mocked(countPins).mockClear();
  context.isLoaded = false;
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
test("selection before style readiness owns the camera and ready fires once", () => {
  const fake = fakeMap();
  context.map = fake.map as unknown as MapLibreMap;
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
test("a map hidden behind another screen stops its camera and takes data only when shown", () => {
  const fake = fakeMap();
  context.map = fake.map as unknown as MapLibreMap;
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
  expect(fake.map.resize.mock.invocationCallOrder[0]).toBeLessThan(
    fake.map.fitBounds.mock.invocationCallOrder[0],
  );
  expect(pins).toHaveBeenLastCalledWith(pinsGeoJSON([]));
  expect(fake.map.fitBounds).toHaveBeenCalledTimes(1);
});
test("cleanup pairs every listener, ignores delayed borders and tolerates parent removal", async () => {
  const fake = fakeMap();
  context.map = fake.map as unknown as MapLibreMap;
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
  expect(fake.map.off.mock.calls).toEqual(
    expect.arrayContaining(fake.map.on.mock.calls),
  );
  expect(fake.map.off).toHaveBeenCalledTimes(fake.map.on.mock.calls.length);
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
  const fake = fakeMap();
  context.map = fake.map as unknown as MapLibreMap;
  const initial = props();
  const view = render(<CardMap {...initial} />);
  act(() => fake.emit("error", { error: Error("style failed") }));
  expect(initial.onError).toHaveBeenCalledWith("Error: style failed");
  view.unmount();
  const timed = props();
  const timerView = render(<CardMap {...timed} />);
  act(() => vi.advanceTimersByTime(19999));
  expect(timed.onError).not.toHaveBeenCalled();
  act(() => vi.advanceTimersByTime(1));
  expect(timed.onError).toHaveBeenCalledOnce();
  timerView.unmount();
  context.isLoaded = true;
  const loaded = props();
  render(<CardMap {...loaded} />);
  act(() => fake.emit("idle"));
  act(() => fake.emit("error", { error: Error("tile failed") }));
  expect(loaded.onWarning).toHaveBeenCalledWith("Error: tile failed");
  expect(loaded.onError).not.toHaveBeenCalled();
});
test("counts are computed once per source and synchronized once per level or source change", () => {
  const fake = fakeMap();
  context.map = fake.map as unknown as MapLibreMap;
  context.isLoaded = true;
  const initial = props();
  const view = render(<CardMap {...initial} />);
  expect(countPins).toHaveBeenCalledTimes(1);
  const writes = fake.sources.get("card-level-counts")!.setData;
  const before = writes.mock.calls.length;
  expect(before).toBe(0);
  const focused = { ...initial, focus: focusForPrefTap("東京都") };
  view.rerender(<CardMap {...focused} />);
  expect(countPins).toHaveBeenCalledTimes(1);
  expect(writes).toHaveBeenCalledTimes(before + 1);
  view.rerender(
    <CardMap {...focused} countPinsSource={[pin, { ...pin, id: "p2" }]} />,
  );
  expect(countPins).toHaveBeenCalledTimes(2);
  expect(writes).toHaveBeenCalledTimes(before + 2);
  view.rerender(<CardMap {...initial} countPinsSource={[]} />);
  expect(countPins).toHaveBeenCalledTimes(3);
  expect(writes).toHaveBeenCalledTimes(before + 3);
});

test("initialization and disposal are idempotent, including StrictMode remount", () => {
  const fake = fakeMap();
  const initial = props();
  const runtime = createMapRuntime(
    fake.map as unknown as MapLibreMap,
    () => initial,
  );
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
  context.map = fake.map as unknown as MapLibreMap;
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
  const fake = fakeMap();
  context.map = fake.map as unknown as MapLibreMap;
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
  fake.setZoom(6);
  act(() => fake.emit("zoom", { fromApp: true }));
  expect(initial.onFocus).not.toHaveBeenCalled();
  fake.setZoom(5);
  act(() => fake.emit("zoom", { originalEvent: {} }));
  expect(initial.onFocus).toHaveBeenCalledWith(
    expect.objectContaining({ pref: null, preserveCamera: true }),
  );
  const moves = fake.map.fitBounds.mock.calls.length;
  view.rerender(
    <CardMap
      {...next}
      focus={{ area: null, pref: null, preserveCamera: true }}
    />,
  );
  expect(fake.map.fitBounds).toHaveBeenCalledTimes(moves);
});

test("border request starts after ready and uses the latest focus when it finishes", async () => {
  const fake = fakeMap();
  context.map = fake.map as unknown as MapLibreMap;
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
  expect(fake.sources.size).toBe(0);
});

test("style readiness changes release the old registration before registering again", () => {
  const fake = fakeMap();
  context.map = fake.map as unknown as MapLibreMap;
  context.isLoaded = true;
  const initial = props();
  const view = render(<CardMap {...initial} />);
  const additions = fake.map.addSource.mock.calls.length;
  context.isLoaded = false;
  view.rerender(<CardMap {...initial} />);
  expect(fake.sources.size).toBe(0);
  context.isLoaded = true;
  view.rerender(<CardMap {...initial} />);
  expect(fake.map.addSource).toHaveBeenCalledTimes(additions * 2);
  act(() => fake.emit("idle"));
  expect(initial.onReady).toHaveBeenCalledOnce();
});

test("public selectionPadding measures the bar and collapsed actions, excluding the modal", () => {
  const root = document.createElement("div");
  root.className = "explorer";
  const container = document.createElement("div");
  container.getBoundingClientRect = () => new DOMRect(0, 0, 400, 800);
  const header = document.createElement("div");
  header.className = "map-search-bar";
  header.getBoundingClientRect = () => new DOMRect(0, 0, 400, 64);
  const dialog = document.createElement("dialog");
  dialog.className = "map-search-dialog";
  dialog.getBoundingClientRect = () => new DOMRect(0, 0, 400, 800);
  const detail = document.createElement("div");
  detail.className = "detail-panel";
  Object.defineProperty(detail, "offsetHeight", { value: 800 });
  detail.style.setProperty("--sheet-summary-height", "300px");
  const actions = document.createElement("div");
  actions.className = "detail-actions";
  Object.defineProperty(actions, "offsetHeight", { value: 60 });
  detail.append(actions);
  root.append(container, header, dialog, detail);
  expect(selectionPadding(container, 3)).toEqual({
    left: 24,
    right: 24,
    top: 84,
    bottom: 320,
  });
  detail.classList.add("is-collapsed");
  expect(selectionPadding(container, 3)).toEqual({
    left: 24,
    right: 24,
    top: 84,
    bottom: 80,
  });
});

test.each([2, 10])(
  "tap selects only the nearest rendered pin among %i without zooming",
  (count) => {
    const fake = fakeMap();
    context.map = fake.map as unknown as MapLibreMap;
    context.isLoaded = true;
    const initial = props();
    render(<CardMap {...initial} />);
    const features = Array.from({ length: count }, (_, index) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [index === 1 ? 102 : 90, 100] },
      properties: { id: `p${index}`, cardIds: JSON.stringify([`c${index}`]) },
    }));
    fake.map.queryRenderedFeatures
      .mockReturnValueOnce([])
      .mockReturnValueOnce([])
      .mockReturnValueOnce(features as never[]);
    act(() => fake.emit("click", { point: { x: 100, y: 100 } }));
    expect(initial.onSelect).toHaveBeenCalledExactlyOnceWith(["c1"], "p1");
    expect(fake.map.easeTo).not.toHaveBeenCalled();
  },
);

test("equal distance keeps the topmost rendered pin and its complete card group", () => {
  const fake = fakeMap();
  context.map = fake.map as unknown as MapLibreMap;
  context.isLoaded = true;
  const initial = props();
  render(<CardMap {...initial} />);
  const features = [
    {
      geometry: { type: "Point", coordinates: [98, 100] },
      properties: { id: "top", cardIds: '["a","b"]' },
    },
    {
      geometry: { type: "Point", coordinates: [102, 100] },
      properties: { id: "lower", cardIds: '["c"]' },
    },
  ];
  fake.map.queryRenderedFeatures
    .mockReturnValueOnce([])
    .mockReturnValueOnce([])
    .mockReturnValueOnce(features as never[]);
  act(() => fake.emit("click", { point: { x: 100, y: 100 } }));
  expect(initial.onSelect).toHaveBeenCalledExactlyOnceWith(["a", "b"], "top");
  expect(fake.map.easeTo).not.toHaveBeenCalled();
});

test("E1 starts from national bounds instead of a fixed zoom", () => {
  const fake = fakeMap();
  context.map = fake.map as unknown as MapLibreMap;
  render(<CardMap {...props()} />);
  expect(context.options.attributionControl).toEqual({
    compact: false,
  });
  expect(context.options.zoom).toBeUndefined();
  expect(context.options.bounds).toEqual(
    focusCamera({ area: null, pref: null }).bounds,
  );
  expect(context.options.fitBoundsOptions).toMatchObject({
    padding: { top: 72, left: 16, right: 16, bottom: 16 },
  });
});

test("OS changes repaint installed resources and source colors without moving the camera or replacing the map", () => {
  let listener = () => {};
  const media = {
    matches: false,
    addEventListener: vi.fn((_event, fn) => {
      listener = fn;
    }),
    removeEventListener: vi.fn(),
  };
  vi.stubGlobal("matchMedia", () => media);
  const fake = fakeMap();
  const initial = { ...props(), selectedPins: [pin] };
  const runtime = createMapRuntime(
    fake.map as unknown as MapLibreMap,
    () => initial,
  );
  runtime.initialize();
  const moves = fake.map.fitBounds.mock.calls.length;
  media.matches = true;
  listener();
  expect(fake.map.setPaintProperty).toHaveBeenCalledWith(
    "card-level-counts",
    "circle-color",
    "#e8e6df",
  );
  expect(fake.map.updateImage).toHaveBeenCalledTimes(5);
  for (const id of ["card-pins", "card-selected"])
    expect(
      fake.sources.get(id)!.setData.mock.lastCall![0].features[0].properties
        .color,
    ).toBe("#609b85");
  expect(fake.map.fitBounds).toHaveBeenCalledTimes(moves);
  expect(fake.sources.size).toBe(4);
  media.matches = false;
  listener();
  expect(
    fake.sources.get("card-pins")!.setData.mock.lastCall![0].features[0]
      .properties.color,
  ).toBe("#2e6f62");
  runtime.dispose();
  expect(media.removeEventListener).toHaveBeenCalledWith("change", listener);
});

test("reconciles a theme change between the style transform and runtime initialization", () => {
  const fake = fakeMap();
  fake.map.addLayer({
    id: "background",
    type: "background",
    paint: { "background-color": "#202723" },
  } as never);
  const initial = props();
  const runtime = createMapRuntime(
    fake.map as unknown as MapLibreMap,
    () => initial,
  );
  runtime.initialize();
  expect(fake.map.setPaintProperty).toHaveBeenCalledWith(
    "background",
    "background-color",
    "#efede8",
  );
  runtime.dispose();
});

test("national badge taps choose the nearest centre within 22px", () => {
  const fake = fakeMap();
  context.map = fake.map as unknown as MapLibreMap;
  context.isLoaded = true;
  const initial = props();
  render(<CardMap {...initial} />);
  fake.map.queryRenderedFeatures.mockReturnValue([
    {
      geometry: { type: "Point", coordinates: [80, 100] },
      properties: { kind: "area", id: "chubu" },
    },
    {
      geometry: { type: "Point", coordinates: [121, 100] },
      properties: { kind: "area", id: "kanto" },
    },
  ] as never[]);
  act(() => fake.emit("click", { point: { x: 102, y: 100 } }));
  expect(initial.onFocus).toHaveBeenCalledExactlyOnceWith({
    area: "kanto",
    pref: null,
  });
});
test("national labels select their own badge beyond its circle", () => {
  const fake = fakeMap();
  context.map = fake.map as unknown as MapLibreMap;
  context.isLoaded = true;
  const initial = props();
  render(<CardMap {...initial} />);
  fake.map.queryRenderedFeatures.mockReturnValue([
    {
      geometry: { type: "Point", coordinates: [80, 100] },
      properties: { kind: "area", id: "chubu" },
    },
  ] as never[]);
  act(() => fake.emit("click", { point: { x: 40, y: 100 } }));
  expect(initial.onFocus).toHaveBeenCalledExactlyOnceWith({
    area: "chubu",
    pref: null,
  });
});

test("national badge hit radius excludes centres farther than 22px", () => {
  const fake = fakeMap();
  context.map = fake.map as unknown as MapLibreMap;
  context.isLoaded = true;
  const initial = props();
  render(<CardMap {...initial} />);
  fake.map.queryRenderedFeatures.mockReturnValueOnce([
    {
      geometry: { type: "Point", coordinates: [77.9, 100] },
      properties: { kind: "area", id: "chubu" },
    },
  ] as never[]);
  act(() => fake.emit("click", { point: { x: 100, y: 100 } }));
  expect(initial.onFocus).not.toHaveBeenCalled();
});

test("national camera uses map width and counts refresh across 600px on resize", () => {
  const fake = fakeMap();
  context.map = fake.map as unknown as MapLibreMap;
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
  fake.map.getContainer().getBoundingClientRect = () =>
    new DOMRect(0, 0, 1440, 900);
  act(() => fake.emit("resize"));
  expect(
    fake.sources
      .get("card-level-counts")
      ?.setData.mock.lastCall?.[0].features.every(
        (f: { properties: { valueSize: number } }) =>
          f.properties.valueSize === 13,
      ),
  ).toBe(true);
  fake.map.getContainer().getBoundingClientRect = () =>
    new DOMRect(0, 0, 412, 915);
  act(() => fake.emit("resize"));
  expect(
    fake.sources
      .get("card-level-counts")
      ?.setData.mock.lastCall?.[0].features.every(
        (f: { properties: { valueSize: number } }) =>
          f.properties.valueSize === 11,
      ),
  ).toBe(true);
});
