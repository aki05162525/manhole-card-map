import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { StrictMode } from "react";
import { createMapRuntime } from "./map-runtime";
import type { Map as MapLibreMap } from "maplibre-gl";
import type { MapProps } from "../../components/ui/map";
import { fakeMapLibre, type FakeFeature } from "./fake-maplibre";
import CardMap, { selectionPadding, type CardMapProps } from "./card-map";
import { countPins, focusForPrefTap, focusCamera } from "./map-levels";
import { pinsGeoJSON } from "./mapcn-data";
import { ScreenActivity } from "../../shared/browser/screen-activity";
import type { Pin } from "../../domain/types";
const context = vi.hoisted(() => ({
  map: null as MapLibreMap | null,
  isLoaded: false,
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
  useMap: () => context,
}));
vi.mock("./map-levels", async (original) => {
  const module = await original<typeof import("./map-levels")>();
  return { ...module, countPins: vi.fn(module.countPins) };
});
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
  vi.mocked(countPins).mockClear();
  context.isLoaded = false;
  context.broken = false;
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
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
  act(() => {
    vi.advanceTimersByTime(1);
  });
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
test("counts are computed once per source and synchronized once per level or source change", () => {
  const fake = fakeMapLibre();
  context.map = fake.maplibre;
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
  expect(fake.sources.size).toBe(0);
});

test("style readiness changes release the old registration before registering again", () => {
  const fake = fakeMapLibre();
  context.map = fake.maplibre;
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
  // Folded away, the sheet shows its peek, which is taller than its bar.
  detail.style.setProperty("--sheet-peek-height", "72px");
  detail.classList.add("is-collapsed");
  expect(selectionPadding(container, 3)).toEqual({
    left: 24,
    right: 24,
    top: 84,
    bottom: 92,
  });
  // The breadcrumbs sit under the bar, and the pins stay clear of them.
  const breadcrumbs = document.createElement("nav");
  breadcrumbs.className = "map-actions";
  breadcrumbs.getBoundingClientRect = () => new DOMRect(180, 72, 204, 44);
  root.append(breadcrumbs);
  expect(selectionPadding(container, 3)).toEqual({
    left: 24,
    right: 24,
    top: 136,
    bottom: 92,
  });
});

test.each([2, 10])(
  "tap selects only the nearest rendered pin among %i without zooming",
  (count) => {
    const fake = fakeMapLibre();
    context.map = fake.maplibre;
    context.isLoaded = true;
    const initial = props();
    render(<CardMap {...initial} />);
    const features = Array.from({ length: count }, (_, index): FakeFeature => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [index === 1 ? 102 : 90, 100] },
      properties: { id: `p${index}`, cardIds: JSON.stringify([`c${index}`]) },
    }));
    fake.map.queryRenderedFeatures
      .mockReturnValueOnce([])
      .mockReturnValueOnce([])
      .mockReturnValueOnce(features);
    act(() => fake.emit("click", { point: { x: 100, y: 100 } }));
    expect(initial.onSelect).toHaveBeenCalledExactlyOnceWith(["c1"], "p1");
    expect(fake.map.easeTo).not.toHaveBeenCalled();
  },
);

test("equal distance keeps the topmost rendered pin and its complete card group", () => {
  const fake = fakeMapLibre();
  context.map = fake.maplibre;
  context.isLoaded = true;
  const initial = props();
  render(<CardMap {...initial} />);
  const features: FakeFeature[] = [
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
    .mockReturnValueOnce(features);
  act(() => fake.emit("click", { point: { x: 100, y: 100 } }));
  expect(initial.onSelect).toHaveBeenCalledExactlyOnceWith(["a", "b"], "top");
  expect(fake.map.easeTo).not.toHaveBeenCalled();
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
  const fake = fakeMapLibre();
  const initial = { ...props(), selectedPins: [pin] };
  const runtime = createMapRuntime(fake.maplibre, () => initial);
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
  expect(fake.sources.size).toBe(5);
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

test("national badge taps choose the nearest centre within 22px", () => {
  const fake = fakeMapLibre();
  context.map = fake.maplibre;
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
  ]);
  act(() => fake.emit("click", { point: { x: 102, y: 100 } }));
  expect(initial.onFocus).toHaveBeenCalledExactlyOnceWith({
    area: "kanto",
    pref: null,
  });
});
test("national labels select their own badge beyond its circle", () => {
  const fake = fakeMapLibre();
  context.map = fake.maplibre;
  context.isLoaded = true;
  const initial = props();
  render(<CardMap {...initial} />);
  fake.map.queryRenderedFeatures.mockReturnValue([
    {
      geometry: { type: "Point", coordinates: [80, 100] },
      properties: { kind: "area", id: "chubu" },
    },
  ]);
  act(() => fake.emit("click", { point: { x: 40, y: 100 } }));
  expect(initial.onFocus).toHaveBeenCalledExactlyOnceWith({
    area: "chubu",
    pref: null,
  });
});

test("national badge hit radius excludes centres farther than 22px", () => {
  const fake = fakeMapLibre();
  context.map = fake.maplibre;
  context.isLoaded = true;
  const initial = props();
  render(<CardMap {...initial} />);
  fake.map.queryRenderedFeatures.mockReturnValueOnce([
    {
      geometry: { type: "Point", coordinates: [77.9, 100] },
      properties: { kind: "area", id: "chubu" },
    },
  ]);
  act(() => fake.emit("click", { point: { x: 100, y: 100 } }));
  expect(initial.onFocus).not.toHaveBeenCalled();
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
  fake.setSize(412, 915);
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
  runtime.dispose();
});

test("a tap on only unreadable pins dismisses instead of selecting, and shows no pointer", () => {
  const fake = fakeMapLibre();
  context.map = fake.maplibre;
  context.isLoaded = true;
  const initial = props();
  render(<CardMap {...initial} />);
  const unreadable: FakeFeature[] = [
    {
      geometry: { type: "Point", coordinates: [100, 100] },
      properties: { id: "empty", cardIds: "[]" },
    },
    {
      geometry: { type: "Point", coordinates: [101, 100] },
      properties: { id: 7, cardIds: '["c"]' },
    },
  ];
  fake.map.queryRenderedFeatures
    .mockReturnValueOnce([])
    .mockReturnValueOnce([])
    .mockReturnValueOnce(unreadable);
  act(() => fake.emit("click", { point: { x: 100, y: 100 } }));
  expect(initial.onSelect).not.toHaveBeenCalled();
  expect(initial.onDismiss).toHaveBeenCalledTimes(1);
  fake.map.queryRenderedFeatures
    .mockReturnValueOnce([])
    .mockReturnValueOnce([])
    .mockReturnValueOnce(unreadable);
  act(() => fake.emit("mousemove", { point: { x: 100, y: 100 } }));
  expect(fake.maplibre.getCanvas().style.cursor).toBe("");
});

test("a badge of an unknown kind is not focused, and the pin behind it is selected", () => {
  const fake = fakeMapLibre();
  context.map = fake.maplibre;
  context.isLoaded = true;
  const initial = props();
  render(<CardMap {...initial} />);
  const unknown: FakeFeature = {
    geometry: { type: "Point", coordinates: [100, 100] },
    properties: { kind: "city", id: "東京都" },
  };
  fake.map.queryRenderedFeatures
    .mockReturnValueOnce([unknown])
    .mockReturnValueOnce([unknown])
    .mockReturnValueOnce([
      {
        geometry: { type: "Point", coordinates: [100, 100] },
        properties: { id: "p", cardIds: '["c"]' },
      },
    ]);
  act(() => fake.emit("click", { point: { x: 100, y: 100 } }));
  expect(initial.onFocus).not.toHaveBeenCalled();
  expect(initial.onSelect).toHaveBeenCalledExactlyOnceWith(["c"], "p");
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
  runtime.dispose();
});
