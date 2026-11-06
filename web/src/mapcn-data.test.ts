import { describe, expect, it, vi } from "vitest";
import {
  emphasizePrefectureBorders,
  installBorderLayers,
  loadBorderData,
  isAreaBorder,
  pinsGeoJSON,
  featureCardIds,
} from "./mapcn-data";
import type { Pin } from "./types";
const pin: Pin = {
  id: "p1",
  cardIds: ["a", "b"],
  kind: "place",
  pref: "東京都",
  status: "unknown",
  lat: 35,
  lng: 139,
  reference: true,
};
describe("mapcn data", () => {
  it("preserves coordinate order and card/reference metadata", () => {
    const feature = pinsGeoJSON([pin]).features[0]!;
    expect(feature.geometry.coordinates).toEqual([139, 35]);
    expect(feature.properties).toMatchObject({
      id: "p1",
      kind: "place",
      pref: "東京都",
      status: "unknown",
      reference: true,
    });
    expect(featureCardIds(feature)).toEqual(["a", "b"]);
  });
  it("reads serialized IDs returned by MapLibre and ignores malformed properties", () => {
    expect(
      featureCardIds({ properties: { cardIds: '["a","a","b"]' } }),
    ).toEqual(["a", "b"]);
    expect(featureCardIds({ properties: { cardIds: "invalid" } })).toEqual([]);
    expect(featureCardIds({ properties: { cardIds: '["a",3]' } })).toEqual([
      "a",
    ]);
  });
});

it("border layers use zoom expressions and update only for a changed focus", () => {
  const map = {
    getLayer: () => undefined,
    getStyle: () => ({ version: 8 as const, sources: {}, layers: [] }),
    addSource: vi.fn(),
    addLayer: vi.fn(),
    setPaintProperty: vi.fn(),
    setLayoutProperty: vi.fn(),
    setLayerZoomRange: vi.fn(),
  };
  const update = installBorderLayers(map, {
    type: "FeatureCollection",
    features: [],
  });
  expect(map.addLayer).toHaveBeenCalledTimes(2);
  expect(map.addLayer.mock.calls[0][0].maxzoom).toBe(7);
  expect(map.addLayer.mock.calls[1][0].maxzoom).toBe(5.6);
  update({ area: null, pref: null });
  expect(map.setPaintProperty).toHaveBeenCalledWith(
    "pref-borders",
    "line-opacity",
    ["step", ["zoom"], 0, 5.6, 1],
  );
  map.setPaintProperty.mockClear();
  map.setLayoutProperty.mockClear();
  update({ area: null, pref: null });
  expect(map.setPaintProperty).not.toHaveBeenCalled();
  expect(map.setLayoutProperty).not.toHaveBeenCalled();
  update({ area: "kanto", pref: null });
  expect(map.setPaintProperty).toHaveBeenCalledWith(
    "pref-borders",
    "line-opacity",
    1,
  );
  expect(map.setLayoutProperty).toHaveBeenCalledWith(
    "area-borders",
    "visibility",
    "none",
  );
});
it("background borders preserve original paint/filter below 7 and use detail above 7", () => {
  const original = {
    id: "boundary_state",
    type: "line" as const,
    source: "tiles",
    minzoom: 4,
    paint: { "line-color": "#ead5d7" },
    filter: true as const,
  };
  const map = {
    getStyle: () => ({ version: 8 as const, sources: {}, layers: [original] }),
    addLayer: vi.fn(),
    setLayerZoomRange: vi.fn(),
    setPaintProperty: vi.fn(),
    setFilter: vi.fn(),
  };
  emphasizePrefectureBorders(map);
  expect(map.addLayer).toHaveBeenCalledWith(
    { ...original, id: "pref-borders-basemap-low", maxzoom: 7 },
    "boundary_state",
  );
  expect(map.setLayerZoomRange).toHaveBeenCalledWith("boundary_state", 7, 24);
  expect(map.setPaintProperty).toHaveBeenCalledWith(
    "boundary_state",
    "line-color",
    "#7d6a78",
  );
  expect(map.setFilter).not.toHaveBeenCalled();
});
it("missing background layer is harmless", () => {
  const map = {
    getStyle: () => ({ version: 8 as const, sources: {}, layers: [] }),
    addLayer: vi.fn(),
    setLayerZoomRange: vi.fn(),
    setPaintProperty: vi.fn(),
  };
  emphasizePrefectureBorders(map);
  expect(map.addLayer).not.toHaveBeenCalled();
  expect(map.setPaintProperty).not.toHaveBeenCalled();
});
it("failed optional fetch does not throw or invoke the installer", async () => {
  const install = vi.fn();
  await loadBorderData("/borders.json", install, async () => {
    throw Error("offline");
  });
  await loadBorderData(
    "/borders.json",
    install,
    async () => new Response("missing", { status: 404 }),
  );
  await loadBorderData("/borders.json", install, async () => new Response("{"));
  expect(install).not.toHaveBeenCalled();
});
it("area borders derive only from the existing prefecture master", () => {
  expect(isAreaBorder(["07", "08"])).toBe(true);
  expect(isAreaBorder(["08", "09"])).toBe(false);
});

it("source has each shared line once and derives the area filter without changing coordinates", () => {
  const map = {
    getLayer: () => undefined,
    getStyle: () => ({ version: 8 as const, sources: {}, layers: [] }),
    addSource: vi.fn(),
    addLayer: vi.fn(),
    setPaintProperty: vi.fn(),
    setLayoutProperty: vi.fn(),
    setLayerZoomRange: vi.fn(),
  };
  const coordinates = [
    [140, 35],
    [140, 36],
  ];
  installBorderLayers(map, {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: { p: ["07", "08"] },
        geometry: { type: "LineString", coordinates },
      },
    ],
  });
  expect(map.addSource.mock.calls[0][1].data.features).toEqual([
    {
      type: "Feature",
      properties: { p: ["07", "08"], area: true },
      geometry: { type: "LineString", coordinates },
    },
  ]);
});

it("fetch success installs data exactly once", async () => {
  const install = vi.fn();
  const data = { type: "FeatureCollection", features: [] };
  await loadBorderData("/borders.json", install, async () =>
    Response.json(data),
  );
  expect(install).toHaveBeenCalledExactlyOnceWith(data);
});

it("tracked borders cover every land-connected prefecture and stay within the compressed budget", async () => {
  const { readFileSync } = await import("node:fs");
  const { gzipSync } = await import("node:zlib");
  const bytes = readFileSync(new URL("./pref-borders.json", import.meta.url));
  expect(gzipSync(bytes).length).toBeLessThanOrEqual(30 * 1024);
  const data = JSON.parse(bytes.toString());
  const codes = new Set(
    data.features.flatMap(
      (f: { properties: { p: string[] } }) => f.properties.p,
    ),
  );
  expect([...codes].sort()).toEqual(
    Array.from({ length: 45 }, (_, i) => String(i + 2).padStart(2, "0")),
  );
  for (const feature of data.features) {
    expect(Object.keys(feature.properties)).toEqual(["p"]);
    expect(feature.properties.p[0] < feature.properties.p[1]).toBe(true);
    expect(feature.geometry.coordinates.length).toBeGreaterThanOrEqual(2);
  }
});
