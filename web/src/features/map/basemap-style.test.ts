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
  expect(result.layers.at(-2)?.minzoom).toBe(7);
  expect(style).toEqual(before);
});
it("bounds count badge radii", () => {
  expect(badgeRadius(0)).toBe(16);
  expect(badgeRadius(100)).toBe(24);
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
it("adds three-quarter-pixel road casings while preserving zoom widths and falls back on failure", () => {
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
    "line-width": 0.75,
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

it("uses Japanese place names only after the pin threshold", () => {
  const style: StyleSpecification = {
    version: 8,
    sources: {},
    layers: [
      {
        id: "city",
        type: "symbol",
        source: "v",
        "source-layer": "places",
        layout: { "text-field": ["get", "name:en"] },
      },
    ],
  };
  expect(transformBasemapStyle(style).layers[0]).toMatchObject({
    minzoom: 7,
    layout: { "text-field": ["coalesce", ["get", "name:ja"], ["get", "name"]] },
  });
});
it("keeps boundary contrast at least 3:1 and water labels at least 4.5:1", async () => {
  const { readFileSync } = await import("node:fs");
  const css = readFileSync(
    new URL("../../shared/ui/tokens.css", import.meta.url),
    "utf8",
  );
  const boundary = css.match(/--boundary: (#[0-9a-f]+);/)![1];
  const style: StyleSpecification = {
    version: 8,
    sources: {},
    layers: [
      { id: "land", type: "background" },
      { id: "water", type: "fill", source: "v", "source-layer": "water" },
      { id: "label", type: "symbol", source: "v", "source-layer": "water" },
    ],
  };
  const layers = transformBasemapStyle(style).layers as any[];
  const land = layers[0].paint["background-color"],
    water = layers[1].paint["fill-color"],
    label = layers[2].paint["text-color"];
  const luminance = (hex: string) =>
    [1, 3, 5]
      .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
      .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
  const contrast = (a: string, b: string) => {
    const values = [luminance(a), luminance(b)].sort((x, y) => x - y);
    return (values[1] + 0.05) / (values[0] + 0.05);
  };
  expect(contrast(boundary, land)).toBeGreaterThanOrEqual(3);
  expect(contrast(boundary, water)).toBeGreaterThanOrEqual(3);
  expect(contrast(label, water)).toBeGreaterThanOrEqual(4.5);
});
