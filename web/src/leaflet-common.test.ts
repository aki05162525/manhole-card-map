import { beforeEach, expect, it, vi } from "vitest";
import type { Pin } from "./types";
const state = vi.hoisted(() => ({
  zoom: 10,
  markers: [] as unknown[],
  clusterClick: undefined as undefined | ((event: unknown) => void),
  options: {} as Record<string, unknown>,
  setView: vi.fn(),
  fitBounds: vi.fn(),
}));
vi.mock("leaflet.markercluster", () => ({}));
vi.mock("./types", async (original) => ({
  ...(await original<typeof import("./types")>()),
  painted: async () => {},
}));
vi.mock("leaflet", () => {
  const layer = () => ({
    addTo() {
      return this;
    },
    on() {
      return this;
    },
    clearLayers() {},
    remove() {},
  });
  return {
    default: {
      map: () => ({
        setView: state.setView,
        fitBounds: state.fitBounds,
        getZoom: () => state.zoom,
        invalidateSize() {},
      }),
      markerClusterGroup: (options: Record<string, unknown>) => {
        state.options = options;
        return {
          ...layer(),
          on(_name: string, callback: (event: unknown) => void) {
            state.clusterClick = callback;
          },
          addLayer(marker: unknown) {
            state.markers.push(marker);
          },
        };
      },
      marker: layer,
      layerGroup: layer,
      circleMarker: layer,
      divIcon: () => ({}),
      latLngBounds: (points: unknown) => points,
    },
  };
});
import { leafletCreate } from "./leaflet-common";
const pins: Pin[] = [
  {
    id: "a",
    cardIds: ["1", "2"],
    lat: 35,
    lng: 139,
    kind: "lid",
    status: "active",
    reference: false,
  },
  {
    id: "b",
    cardIds: ["2", "3"],
    lat: 35,
    lng: 139,
    kind: "place",
    status: "active",
    reference: false,
  },
];
beforeEach(() => {
  state.markers = [];
  state.zoom = 10;
  vi.clearAllMocks();
});
it("selects all cluster cards at the ceiling and zooms below it", async () => {
  const select = vi.fn();
  const adapter = leafletCreate(10, async () => {})(pins, select, null);
  await adapter.ready;
  const zoomToBounds = vi.fn();
  const layer = { getAllChildMarkers: () => state.markers, zoomToBounds };
  state.clusterClick!({ layer });
  expect(select).toHaveBeenCalledWith(["1", "2", "3"]);
  expect(zoomToBounds).not.toHaveBeenCalled();
  expect(state.options.spiderfyOnMaxZoom).toBe(false);
  state.zoom = 9;
  state.clusterClick!({ layer });
  expect(zoomToBounds).toHaveBeenCalledOnce();
});
it("caps restored view, locate and selection zoom without moving pins", async () => {
  const adapter = leafletCreate(10, async () => {})(pins, vi.fn(), {
    lat: 35,
    lng: 139,
    zoom: 18,
  });
  await adapter.ready;
  expect(state.setView).toHaveBeenCalledWith([35, 139], 10);
  adapter.locate(34, 138);
  expect(state.setView).toHaveBeenCalledWith([34, 138], 10);
  adapter.select(pins);
  expect(state.fitBounds).toHaveBeenCalledWith(
    [
      [35, 139],
      [35, 139],
    ],
    expect.objectContaining({ maxZoom: 10 }),
  );
});
