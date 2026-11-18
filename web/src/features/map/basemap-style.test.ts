import { assert, expect, it } from "vitest";
import type {
  DataDrivenPropertyValueSpecification,
  FilterSpecification,
  LayerSpecification,
  StyleSpecification,
} from "maplibre-gl";
import { transformBasemapStyle } from "./basemap-style";
import { badgeRadius } from "./map-levels";
import { contrastRatio } from "../../../../tools/design/color-contrast.mjs";
it("recolors a fixture and CARTO/OpenMapTiles sample, preserves unknown layers and input", () => {
  const layers: LayerSpecification[] = [
    { id: "bg", type: "background", paint: { "background-color": "red" } },
    ...["water", "landcover", "landuse", "park", "building", "buildings"].map(
      (source, i): LayerSpecification => ({
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
  const style: StyleSpecification = { version: 8, sources: {}, layers };
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
  const width: DataDrivenPropertyValueSpecification<number> = {
    type: "exponential",
    stops: [
      [5, 1],
      [12, 8],
    ],
  };
  const style: StyleSpecification = {
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
  };
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
  const [land, water, label] = transformBasemapStyle(style).layers.map(
    (layer, i) => {
      const paint: Record<string, unknown> = { ...layer.paint };
      const color = paint[["background-color", "fill-color", "text-color"][i]];
      assert(typeof color === "string");
      return color;
    },
  );
  expect(contrastRatio(boundary, land)).toBeGreaterThanOrEqual(3);
  expect(contrastRatio(boundary, water)).toBeGreaterThanOrEqual(3);
  expect(contrastRatio(label, water)).toBeGreaterThanOrEqual(4.5);
});

it("names seas and oceans in Japanese only, and drops those without a Japanese name", () => {
  const filter: FilterSpecification = ["==", ["get", "kind"], "sea"];
  const style: StyleSpecification = {
    version: 8,
    sources: {},
    layers: [
      {
        id: "watername_sea",
        type: "symbol",
        source: "carto",
        "source-layer": "water",
        filter,
        layout: { "text-field": ["get", "name"] },
      },
    ],
  };
  const [sea] = transformBasemapStyle(style).layers;
  assert(sea?.type === "symbol");
  expect(sea.layout?.["text-field"]).toEqual(["get", "name:ja"]);
  expect(sea.filter).toEqual(["all", filter, ["has", "name:ja"]]);
});

it("recolors the layers it can read and leaves unexpected ones for MapLibre to judge", () => {
  const odd = [
    null,
    "water",
    { id: "array-paint", type: "fill", "source-layer": "water", paint: ["x"] },
    {
      id: "text-metadata",
      type: "fill",
      "source-layer": "water",
      metadata: "x",
    },
    { id: 3, type: "line", "source-layer": "boundaries" },
    { id: "numeric-source", type: "fill", "source-layer": 3 },
    {
      id: "array-layout",
      type: "symbol",
      "source-layer": "places",
      layout: [],
    },
    {
      id: "text-minzoom",
      type: "symbol",
      "source-layer": "places",
      minzoom: "7",
    },
  ];
  const carto = {
    type: "vector",
    attribution: '<a href="https://carto.com/about-carto/">CARTO</a>',
  };
  const numeric = { type: "vector", attribution: 3 };
  const style = {
    version: 8,
    sources: { carto, numeric },
    layers: [
      ...odd,
      { id: "water", type: "fill", source: "v", "source-layer": "water" },
    ],
  } as unknown as StyleSpecification;
  const before = structuredClone(style);
  const result = transformBasemapStyle(style);
  expect(result.layers.slice(0, odd.length)).toEqual(odd);
  for (const [index, layer] of odd.entries())
    expect(result.layers[index]).toBe(layer);
  expect(result.layers.at(-1)?.paint).toMatchObject({
    "fill-color": expect.any(String),
  });
  expect(result.sources.numeric).toBe(numeric);
  expect(result.sources.carto).toMatchObject({
    attribution: '<a href="https://carto.com/attributions">CARTO</a>',
  });
  expect(style).toEqual(before);
});

it.each([
  ["no sources", { version: 8, layers: [] }],
  ["an array of sources", { version: 8, sources: [], layers: [] }],
  ["a non-object style", "style"],
])("passes a style with %s to MapLibre unchanged", (_, style) => {
  expect(transformBasemapStyle(style as unknown as StyleSpecification)).toBe(
    style,
  );
});
