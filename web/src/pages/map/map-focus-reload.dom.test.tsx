import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
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
  options: null as MapProps | null,
}));
vi.mock("../../components/ui/map", () => ({
  Map: ({ children, ...options }: MapProps) => {
    context.options ??= options;
    return children;
  },
  MapControls: () => null,
  useMap: () => context,
}));
vi.mock("../../features/card-data/use-card-data", () => ({
  useCardData: () => ({ pins: data.pins, data, fixture: true }),
}));
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
  context.options = null;
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
  await waitFor(() => expect(fake.map.addSource).toHaveBeenCalled());
  act(() => fake.emit("idle"));
}
const crumbs = () =>
  screen.queryByRole("navigation", { name: "地図の移動" })?.textContent ?? null;

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
    expect(crumbs()).toBe(shown);
    // The map is created over that level and fitted to it once ready.
    expect(context.options?.bounds).toEqual(focusCamera(focus).bounds);
    expect(fake.map.fitBounds).toHaveBeenCalledOnce();
    const { bounds, maxZoom } = focusCamera(focus, data.pins);
    expect(fake.map.fitBounds.mock.lastCall?.[0]).toEqual(bounds);
    expect(fake.map.fitBounds.mock.lastCall?.[1]).toMatchObject({ maxZoom });
    // Opening reads the entry; it writes nothing.
    expect(history.state).toEqual({ mapFocus: focus });
  },
);

it("a shared card URL keeps its places owning the camera at the nationwide level", async () => {
  history.replaceState(null, "", "/?card=a");
  const App = (await import("./map-page")).default;
  render(<App />);
  await waitFor(() => expect(fake.map.fitBounds).toHaveBeenCalled());
  act(() => fake.emit("idle"));
  expect(crumbs()).toBeNull();
  expect(context.options?.bounds).toEqual(
    focusCamera({ area: null, pref: null }).bounds,
  );
  expect(fake.map.fitBounds).toHaveBeenCalledOnce();
  expect(fake.map.fitBounds.mock.lastCall?.[0]).toEqual([
    [139.7, 35.6],
    [139.7, 35.6],
  ]);
});
