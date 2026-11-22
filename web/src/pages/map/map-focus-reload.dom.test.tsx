import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { useEffect, useSyncExternalStore } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { Map as MapLibreMap } from "maplibre-gl";
import type { MapProps } from "../../components/ui/map";
import type { Data } from "../../domain/types";
import { fakeMapLibre } from "../../features/map/fake-maplibre";
import { focusCamera, type MapFocus } from "../../features/map/map-levels";

// The real map runtime on a fake MapLibre: the page as a reload opens it.
const context = vi.hoisted(() => ({
  map: null as MapLibreMap | null,
  isLoaded: true,
  isStyleLoaded: true,
  /** The options MapLibre was created with. */
  created: null as Omit<MapProps, "createOptions" | "children"> | null,
  /** The focus the map was first handed. */
  focus: null as MapFocus | null,
}));
vi.mock("../../components/ui/map", () => ({
  // mapcn creates MapLibre once, after mounting, from the latest props and
  // what it measures from the container.
  Map: ({ children, createOptions, ...options }: MapProps) => {
    useEffect(() => {
      context.created ??= {
        ...options,
        ...createOptions?.(context.map!.getContainer() as HTMLDivElement),
      };
    });
    return children;
  },
  MapControls: () => null,
  useMap: () => context,
}));
vi.mock("../../features/map/map-layers", async (original) => {
  const { MapLayers } =
    await original<typeof import("../../features/map/map-layers")>();
  return {
    MapLayers: (props: Parameters<typeof MapLayers>[0]) => {
      context.focus ??= props.focus;
      return MapLayers(props);
    },
  };
});
// The pins are there when the map is created unless a test holds them back.
const card = vi.hoisted(() => ({
  loaded: true,
  listeners: new Set<() => void>(),
  load() {
    card.loaded = true;
    for (const listener of card.listeners) listener();
  },
}));
vi.mock(import("../../features/card-data/use-card-data"), async () => {
  const hooks = (
    await import("../../features/card-data/test-card-data")
  ).loadedCardDataHooks(() => data);
  return {
    ...hooks,
    useCardData: () => {
      const loaded = useSyncExternalStore(
        (listener) => {
          card.listeners.add(listener);
          return () => card.listeners.delete(listener);
        },
        () => card.loaded,
      );
      const result = hooks.useCardData();
      return loaded ? result : { ...result, pins: null };
    },
  };
});
vi.mock("../../shared/browser/painted", () => ({
  painted: () => new Promise<void>(() => {}),
}));
const data: Data = {
  schema: 1,
  updated: "",
  places: [
    {
      id: "p1",
      name: "p1",
      address: "",
      phone: "",
      coordinate: { status: "confirmed", lat: 35.6, lng: 139.7 },
    },
  ],
  relations: [],
  pins: [
    {
      id: "p1",
      kind: "place",
      cardIds: ["a"],
      pref: "東京都",
      lat: 35.6,
      lng: 139.7,
      status: "active",
    },
  ],
  cards: [
    {
      id: "a",
      pref: "東京都",
      city: "千代田区",
      series: "",
      issued: "",
      acquired: "",
      status: "active",
      lid: { status: "unconfirmed" },
      placeText: null,
      hours: null,
      links: null,
    },
  ],
};
let fake: ReturnType<typeof fakeMapLibre>;
beforeEach(() => {
  vi.resetModules();
  fake = fakeMapLibre();
  context.map = fake.maplibre;
  context.created = null;
  context.focus = null;
  card.loaded = true;
  card.listeners.clear();
  vi.stubGlobal("matchMedia", () => ({
    matches: true,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.stubGlobal(
    "fetch",
    vi.fn(() => new Promise(() => {})),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  history.replaceState(null, "", "/");
});

async function reload(state: unknown) {
  history.replaceState(state, "", "/");
  const App = (await import("./map-page")).default;
  render(<App />);
  await waitFor(() => expect(context.created).not.toBeNull());
}
async function ready() {
  await waitFor(() => expect(fake.map.addSource).toHaveBeenCalled());
  act(() => fake.emit("idle"));
}
const crumbs = () =>
  screen.queryByRole("navigation", { name: "地図の移動" })?.textContent ?? null;
/**
 * The first ready fit draws the view the map was created with. MapLibre fits
 * its creation bounds itself, so the fake sees only the ready fit.
 */
function expectReadyKeepsCreatedView() {
  expect(fake.map.fitBounds).toHaveBeenCalledOnce();
  const [bounds, options] = fake.map.fitBounds.mock.lastCall ?? [];
  expect(bounds).toEqual(context.created?.bounds);
  expect(options).toEqual({
    ...context.created?.fitBoundsOptions,
    duration: 0,
  });
}

it.each([
  [{ area: "kanto", pref: "東京都" }, "全国 > 関東 > 東京都"],
  [
    { area: "kanto", pref: "東京都", preserveCamera: true },
    "全国 > 関東 > 東京都",
  ],
  [{ area: "kanto", pref: null }, "全国 > 関東"],
  // A zoom out by hand left this; its camera did not survive the reload.
  [{ area: "kanto", pref: null, preserveCamera: true }, "全国 > 関東"],
  [{ area: null, pref: null }, null],
  [{ area: null, pref: null, preserveCamera: true }, null],
] satisfies [MapFocus, string | null][])(
  "opens at the level the entry holds: %j",
  async (focus, shown) => {
    await reload({ mapFocus: focus });
    await ready();
    expect(crumbs()).toBe(shown);
    // The map takes the level, not the camera a hand zoom-out kept.
    const level = { area: focus.area, pref: focus.pref };
    expect(context.focus).toEqual(level);
    // Created over that level and its pins, already there.
    const { bounds, maxZoom } = focusCamera(level, data.pins);
    expect(context.created?.bounds).toEqual(bounds);
    expect(context.created?.fitBoundsOptions).toMatchObject({ maxZoom });
    expectReadyKeepsCreatedView();
    // Opening reads the entry; it writes nothing.
    expect(history.state).toEqual({ mapFocus: focus });
  },
);

it("pins that arrive after the map was created leave its opening view in place", async () => {
  card.loaded = false;
  const focus = { area: "kanto", pref: "東京都" };
  await reload({ mapFocus: focus });
  // The whole prefecture: its pins are not there yet.
  expect(context.created?.bounds).toEqual(focusCamera(focus).bounds);
  act(() => card.load());
  await ready();
  expect(crumbs()).toBe("全国 > 関東 > 東京都");
  expectReadyKeepsCreatedView();
});

// A hand zoom-out closes the prefecture by the scale it opened at, not by the
// one its pins would fit now: 6.872 for the whole prefecture the map was
// created over, 8.117 for the pins that arrived later.
it.each([
  [6.862, "全国 > 関東 > 東京都", { area: "kanto", pref: "東京都" }],
  [6.3, "全国 > 関東", { area: "kanto", pref: null, preserveCamera: true }],
])(
  "a hand zoom-out to %d after the pins arrived late shows %s",
  async (zoom, shown, written) => {
    card.loaded = false;
    const focus = { area: "kanto", pref: "東京都" };
    const whole = focusCamera(focus).bounds;
    fake.map.cameraForBounds = (bounds: unknown) => ({
      zoom: JSON.stringify(bounds) === JSON.stringify(whole) ? 6.872 : 8.117,
    });
    await reload({ mapFocus: focus });
    act(() => card.load());
    await ready();
    // The ready fit lands where the map opened.
    fake.setZoom(6.872);
    act(() => fake.emit("zoom", { fromApp: true }));
    fake.setZoom(zoom);
    act(() => fake.emit("zoom", { originalEvent: {} }));
    expect(crumbs()).toBe(shown);
    await waitFor(() =>
      expect(history.state).toMatchObject({ mapFocus: written }),
    );
  },
);

it("a shared card URL keeps its places owning the camera at the nationwide level", async () => {
  history.replaceState(null, "", "/?card=a");
  const App = (await import("./map-page")).default;
  render(<App />);
  await waitFor(() => expect(fake.map.fitBounds).toHaveBeenCalled());
  act(() => fake.emit("idle"));
  expect(crumbs()).toBeNull();
  expect(context.created?.bounds).toEqual(
    focusCamera({ area: null, pref: null }).bounds,
  );
  expect(fake.map.fitBounds).toHaveBeenCalledOnce();
  expect(fake.map.fitBounds.mock.lastCall?.[0]).toEqual([
    [139.7, 35.6],
    [139.7, 35.6],
  ]);
});
