import { afterEach, expect, it, vi } from "vitest";
import {
  BORDER_SOURCE,
  LOW_BORDER_LAYER,
  emphasizePrefectureBorders,
  installBorderLayers,
  loadBorderData,
  pinsGeoJSON,
  featureCardIds,
} from "./mapcn-data";
import { fakeMapLibre } from "./fake-maplibre";
import { mapPalette } from "./map-theme";
import type { LayerSpecification } from "maplibre-gl";
import type { Pin } from "../../domain/types";
const pin: Pin = {
  id: "p1",
  cardIds: ["a", "b"],
  kind: "place",
  pref: "東京都",
  status: "unknown",
  lat: 35,
  lng: 139,
};
afterEach(() => {
  vi.unstubAllEnvs();
});
it("draws a pin at its place with its cards, status and theme colour", () => {
  vi.stubEnv("VITE_ACCOUNTS_ENABLED", "false");
  for (const dark of [false, true]) {
    const [feature] = pinsGeoJSON([pin], dark).features;
    expect(feature.id).toBe("p1");
    expect(feature.geometry.coordinates).toEqual([139, 35]);
    expect(feature.properties).toEqual({
      id: "p1",
      kind: "place",
      pref: "東京都",
      status: "unknown",
      cardIds: '["a","b"]',
      color: mapPalette(dark).pins.unknown,
    });
    expect(featureCardIds(feature)).toEqual(["a", "b"]);
  }
});
it("adds what the signed-in user received only where accounts are enabled", () => {
  vi.stubEnv("VITE_ACCOUNTS_ENABLED", "true");
  const receipts = pinsGeoJSON([
    pin,
    { ...pin, id: "p2", receipt: "some" },
  ]).features.map((feature) => feature.properties?.receipt);
  expect(receipts).toEqual(["unknown", "some"]);
});
it("reads serialized IDs returned by MapLibre and ignores malformed properties", () => {
  expect(featureCardIds({ properties: { cardIds: '["a","a","b"]' } })).toEqual([
    "a",
    "b",
  ]);
  expect(featureCardIds({ properties: { cardIds: "invalid" } })).toEqual([]);
  expect(featureCardIds({ properties: { cardIds: '["a",3]' } })).toEqual(["a"]);
  expect(featureCardIds({ properties: { cardIds: '{"a":1}' } })).toEqual([]);
  expect(featureCardIds({ properties: {} })).toEqual([]);
  expect(featureCardIds({ properties: null })).toEqual([]);
});

const noBorders = { type: "FeatureCollection" as const, features: [] };
/** A style with the app's count badges above the provider's layers. */
const styled = (...basemap: LayerSpecification[]) =>
  fakeMapLibre({
    basemap: [
      ...basemap,
      { id: "card-level-counts", type: "circle", source: "counts" },
    ],
  });
it.each([false, true])(
  "draws both border lines below the labels, hidden until a level shows them (dark=%s)",
  (dark) => {
    const fake = styled(
      { id: "land", type: "background" },
      { id: LOW_BORDER_LAYER, type: "line", source: "v", minzoom: 4 },
      { id: "names", type: "symbol", source: "v" },
    );
    const update = installBorderLayers(fake.maplibre, noBorders, dark);
    expect([...fake.layers.keys()]).toEqual([
      "land",
      LOW_BORDER_LAYER,
      "pref-borders",
      "area-borders",
      "names",
      "card-level-counts",
    ]);
    const prefs = fake.layer("line", "pref-borders");
    const areas = fake.layer("line", "area-borders");
    for (const layer of [prefs, areas]) {
      // A focus change switches the border immediately, without a fade.
      expect(layer.paint?.["line-opacity-transition"]).toEqual({
        duration: 0,
        delay: 0,
      });
      expect(layer.source).toBe(BORDER_SOURCE);
      expect(layer.layout?.visibility).toBe("none");
      expect(layer.paint?.["line-color"]).toBe(mapPalette(dark).boundary);
    }
    // Prefecture lines end where pins begin, area lines where prefecture
    // badges do; the provider's pale copy now stops before them.
    expect([prefs.maxzoom, areas.maxzoom]).toEqual([7, 5.6]);
    expect(prefs.filter).toBeUndefined();
    expect(areas.filter).toEqual(["==", ["get", "area"], true]);
    expect(fake.layer("line", LOW_BORDER_LAYER)).toMatchObject({
      minzoom: 4,
      maxzoom: 5.6,
    });
    const shown = () => [
      prefs.layout?.visibility,
      prefs.paint?.["line-opacity"],
      areas.layout?.visibility,
    ];
    update({ area: null, pref: null });
    expect(shown()).toEqual([
      "visible",
      ["step", ["zoom"], 0, 5.6, 1],
      "visible",
    ]);
    // The same level again changes nothing.
    const writes = () =>
      fake.map.setPaintProperty.mock.calls.length +
      fake.map.setLayoutProperty.mock.calls.length;
    const before = writes();
    update({ area: null, pref: null, preserveCamera: true });
    expect(writes()).toBe(before);
    update({ area: "kanto", pref: null });
    expect(shown()).toEqual(["visible", 1, "none"]);
    update({ area: "kanto", pref: "東京都" });
    expect(shown()).toEqual(["visible", 1, "none"]);
    expect(fake.errors).toEqual([]);
  },
);
it("draws the lines below the count badges in a style without labels", () => {
  const fake = styled({ id: "land", type: "background" });
  installBorderLayers(fake.maplibre, noBorders, false);
  expect([...fake.layers.keys()]).toEqual([
    "land",
    "pref-borders",
    "area-borders",
    "card-level-counts",
  ]);
  expect(fake.errors).toEqual([]);
});
it("keeps the provider's border below the pin zoom and draws its own above, until restored", () => {
  const original: LayerSpecification = {
    id: "boundary_state",
    type: "line",
    source: "tiles",
    minzoom: 4,
    paint: { "line-color": "#ead5d7" },
    filter: true,
  };
  for (const dark of [false, true]) {
    const fake = fakeMapLibre({ basemap: [structuredClone(original)] });
    const restore = emphasizePrefectureBorders(fake.maplibre, dark);
    expect([...fake.layers.keys()]).toEqual([
      LOW_BORDER_LAYER,
      "boundary_state",
    ]);
    expect(fake.layer("line", LOW_BORDER_LAYER)).toEqual({
      ...original,
      id: LOW_BORDER_LAYER,
      maxzoom: 7,
    });
    expect(fake.layer("line", "boundary_state")).toEqual({
      ...original,
      minzoom: 7,
      maxzoom: 24,
      paint: {
        "line-color": mapPalette(dark).boundary,
        "line-width": 1.25,
        "line-dasharray": [
          "step",
          ["zoom"],
          ["literal", [2, 2]],
          9,
          ["literal", [3, 2]],
        ],
      },
    });
    restore?.();
    expect(fake.layer("line", "boundary_state")).toEqual({
      ...original,
      maxzoom: 24,
    });
    expect(fake.errors).toEqual([]);
  }
});
it("restores nothing once the border or the whole style is gone", () => {
  const boundary: LayerSpecification = {
    id: "boundary_state",
    type: "line",
    source: "tiles",
  };
  const replaced = fakeMapLibre({ basemap: [boundary] });
  const restore = emphasizePrefectureBorders(replaced.maplibre, false);
  replaced.maplibre.removeLayer("boundary_state");
  restore?.();
  expect(replaced.errors).toEqual([]);
  const removed = fakeMapLibre({ basemap: [{ ...boundary }] });
  const late = emphasizePrefectureBorders(removed.maplibre, false);
  removed.remove();
  expect(() => late?.()).not.toThrow();
});
it("leaves a style without a state border line as it is", () => {
  for (const basemap of [
    [],
    [{ id: "roads", type: "line" as const, source: "tiles" }],
    [{ id: "boundary_state", type: "fill" as const, source: "tiles" }],
  ]) {
    const fake = fakeMapLibre({ basemap });
    expect(emphasizePrefectureBorders(fake.maplibre, false)).toBeUndefined();
    expect([...fake.layers.keys()]).toEqual(basemap.map((layer) => layer.id));
    expect(fake.map.setPaintProperty).not.toHaveBeenCalled();
  }
});
it("installs nothing when the optional borders fail to load", async () => {
  const install = vi.fn();
  const borders = { type: "FeatureCollection", features: [] };
  await loadBorderData("/borders.json", install, async () => {
    throw Error("offline");
  });
  // An error page is not border data, even when it is JSON.
  await loadBorderData("/borders.json", install, async () =>
    Response.json(borders, { status: 404 }),
  );
  await loadBorderData("/borders.json", install, async () => new Response("{"));
  expect(install).not.toHaveBeenCalled();
});
it("marks only lines between different areas in the map source", () => {
  const { map, maplibre } = styled();
  const line = (p: [string, string], longitude: number) => ({
    type: "Feature" as const,
    properties: { p },
    geometry: {
      type: "LineString" as const,
      coordinates: [
        [longitude, 35],
        [longitude, 36],
      ],
    },
  });
  const betweenAreas = line(["07", "08"], 140);
  const withinKanto = line(["08", "09"], 139);
  installBorderLayers(
    maplibre,
    {
      type: "FeatureCollection",
      features: [betweenAreas, withinKanto],
    },
    false,
  );
  expect(map.addSource).toHaveBeenCalledWith(BORDER_SOURCE, {
    type: "geojson",
    data: {
      type: "FeatureCollection",
      features: [
        { ...betweenAreas, properties: { p: ["07", "08"], area: true } },
        { ...withinKanto, properties: { p: ["08", "09"], area: false } },
      ],
    },
  });
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
  const bytes = readFileSync(
    new URL("../../pref-borders.json", import.meta.url),
  );
  expect(gzipSync(bytes).length).toBeLessThanOrEqual(30 * 1024);
  const data = JSON.parse(bytes.toString());
  const codes = new Set<string>(
    data.features.flatMap(
      (f: { properties: { p: string[] } }) => f.properties.p,
    ),
  );
  expect([...codes].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))).toEqual(
    Array.from({ length: 45 }, (_, i) => String(i + 2).padStart(2, "0")),
  );
  for (const feature of data.features) {
    expect(Object.keys(feature.properties)).toEqual(["p"]);
    expect(feature.properties.p[0] < feature.properties.p[1]).toBe(true);
    expect(feature.geometry.coordinates.length).toBeGreaterThanOrEqual(2);
  }
});
