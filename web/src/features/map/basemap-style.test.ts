import { expect, it } from "vitest";
import type { StyleSpecification } from "maplibre-gl";
import { transformBasemapStyle } from "./basemap-style";
import { badgeRadius } from "./map-levels";
it("recolors a fixture and CARTO/OpenMapTiles sample, preserves unknown layers and input", () => {
  const layers = [
    { id: "bg", type: "background", paint: { "background-color": "red" } },
    ...["water", "landcover", "landuse", "park", "building", "buildings"].map(
      (source, i) => ({
        id: String(i),
        type: "fill",
        source: "v",
        "source-layer": source,
      }),
    ),
    { id: "road", type: "line", source: "v", "source-layer": "roads" },
    { id: "label", type: "symbol", source: "v", "source-layer": "places" },
    {
      id: "unknown",
      type: "fill",
      source: "v",
      "source-layer": "custom",
      paint: { "fill-color": "red" },
    },
  ];
  const style = { version: 8, sources: {}, layers } as StyleSpecification;
  const before = structuredClone(style);
  const result = transformBasemapStyle(style);
  expect(
    result.layers.filter((l) =>
      layers.some(
        (original) =>
          original.id === l.id &&
          JSON.stringify(l) !== JSON.stringify(original),
      ),
    ),
  ).toHaveLength(9);
  expect(result.layers[0].paint).toEqual({ "background-color": "#efede8" });
  expect(result.layers.at(-1)).toEqual(layers.at(-1));
  expect(result.layers.at(-2)?.minzoom).toBe(6);
  expect(style).toEqual(before);
});
it("bounds count badge radii", () => {
  expect(badgeRadius(0)).toBe(16);
  expect(badgeRadius(100)).toBe(19.5);
  expect(badgeRadius(10000)).toBe(26);
});

it("recolors the fixture's background-only style", () => {
  const fixture: StyleSpecification = {
    version: 8,
    name: "Synthetic CI background (not a real basemap)",
    sources: {},
    layers: [
      {
        id: "background",
        type: "background",
        paint: { "background-color": "#e8eeee" },
      },
    ],
  };
  const before = structuredClone(fixture);
  expect(transformBasemapStyle(fixture).layers[0].paint).toEqual({
    "background-color": "#efede8",
  });
  expect(fixture).toEqual(before);
});
it("adds half-pixel road casings while preserving zoom widths and falls back on failure", () => {
  const width = {
    stops: [
      [5, 1],
      [12, 8],
    ],
  };
  const style = {
    version: 8,
    sources: {},
    layers: [
      {
        id: "arbitrary",
        type: "line",
        source: "v",
        "source-layer": "roads",
        paint: { "line-width": width },
      },
    ],
  } as StyleSpecification;
  const transformed = transformBasemapStyle(style);
  expect(transformed.layers[0].paint).toMatchObject({
    "line-width": 0.5,
    "line-gap-width": width,
    "line-color": "#d6d1c6",
  });
  expect(transformed.layers[1].paint).toMatchObject({
    "line-width": width,
    "line-color": "#ffffff",
  });
  const bad = { ...style, layers: null } as unknown as StyleSpecification;
  expect(transformBasemapStyle(bad)).toBe(bad);
});
