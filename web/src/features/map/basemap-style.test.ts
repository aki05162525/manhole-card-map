import { assert, expect, it } from "vitest";
import type {
  DataDrivenPropertyValueSpecification,
  FilterSpecification,
  StyleSpecification,
} from "maplibre-gl";
import { basemapRepaint, transformBasemapStyle } from "./basemap-style";
import { fakeMapLibre } from "./fake-maplibre";
import { mapPalette } from "./map-theme";

type Palette = ReturnType<typeof mapPalette>;
const themes = [false, true];
/** A provider's style with these layers, as transformStyle receives it. */
const styleOf = (...layers: unknown[]) =>
  ({ version: 8, sources: {}, layers }) as unknown as StyleSpecification;
/** A layer of any type, with the fields the transform changes. */
type AnyLayer = {
  id: string;
  minzoom?: number;
  filter?: unknown;
  paint?: Record<string, unknown>;
  layout?: Record<string, unknown>;
};
/** The layer after the transform. */
function transformed(layer: Record<string, unknown>, dark: boolean) {
  const result = transformBasemapStyle(styleOf(layer), dark)
    .layers as readonly AnyLayer[];
  const next = result.find((l) => l.id === layer.id);
  assert(next);
  return next;
}

// OpenMapTiles names (CARTO) and the older plural ones.
it.each<[string, string, string, keyof Palette]>([
  ["fill", "water", "fill-color", "water"],
  ["fill", "building", "fill-color", "building"],
  ["fill", "buildings", "fill-color", "building"],
  ["fill", "landcover", "fill-color", "green"],
  ["fill", "park", "fill-color", "green"],
  ["line", "water", "line-color", "water"],
  ["line", "transportation", "line-color", "road"],
  ["line", "roads", "line-color", "road"],
  ["symbol", "place", "text-color", "label"],
  ["symbol", "places", "text-color", "label"],
  ["symbol", "water", "text-color", "label"],
  ["symbol", "waterway", "text-color", "label"],
  ["symbol", "transportation_name", "text-color", "label"],
  ["symbol", "roads", "text-color", "label"],
  ["symbol", "poi", "text-color", "label"],
  ["symbol", "pois", "text-color", "label"],
  ["symbol", "building", "text-color", "label"],
  ["symbol", "buildings", "text-color", "label"],
])(
  "paints a %s layer of %s with its palette colour in both themes",
  (type, source, key, colour) => {
    for (const dark of themes)
      expect(
        transformed(
          { id: "x", type, source: "v", "source-layer": source },
          dark,
        ).paint?.[key],
      ).toBe(mapPalette(dark)[colour]);
  },
);

it.each([
  ["fill", "custom"],
  ["fill", "transportation"],
  ["fill", "boundaries"],
  ["fill", "place"],
  // Rivers and paths are lines in the layers whose names are labels.
  ["line", "waterway"],
  ["line", "transportation_name"],
  ["line", "place"],
  ["circle", "poi"],
  ["circle", "roads"],
  ["symbol", "boundaries"],
  ["symbol", "landcover"],
])("passes a %s layer of %s on as the provider wrote it", (type, source) => {
  const layer = {
    id: "x",
    type,
    source: "v",
    "source-layer": source,
    paint: { [`${type}-opacity`]: 0.5 },
  };
  const expected = structuredClone(layer);
  for (const dark of themes) {
    const { layers } = transformBasemapStyle(styleOf(layer), dark);
    expect(layers).toEqual([expected]);
  }
});

it("paints land use green where it is a park or a wood and as land elsewhere", () => {
  const evaluate = (value: unknown, properties: Record<string, string>) => {
    assert(Array.isArray(value));
    const [match, input, greens, green, other] = value;
    expect(match).toBe("match");
    // A feature with neither property has no class: the empty string.
    expect(input).toEqual(["coalesce", ["get", "class"], ["get", "kind"], ""]);
    assert(Array.isArray(input));
    const kind: unknown = input
      .slice(1)
      .map((item: unknown) =>
        Array.isArray(item) && item[0] === "get" ? properties[item[1]] : item,
      )
      .find((item: unknown) => item !== undefined);
    return Array.isArray(greens) && greens.includes(kind) ? green : other;
  };
  for (const dark of themes) {
    const palette = mapPalette(dark);
    const colour = transformed(
      { id: "x", type: "fill", source: "v", "source-layer": "landuse" },
      dark,
    ).paint?.["fill-color"];
    for (const name of [
      "park",
      "forest",
      "wood",
      "grass",
      "grassland",
      "nature_reserve",
      "national_park",
    ]) {
      expect([name, evaluate(colour, { class: name })]).toEqual([
        name,
        palette.green,
      ]);
      expect([name, evaluate(colour, { kind: name })]).toEqual([
        name,
        palette.green,
      ]);
    }
    expect(evaluate(colour, { class: "residential" })).toBe(palette.land);
    expect(evaluate(colour, { class: "residential", kind: "park" })).toBe(
      palette.land,
    );
    expect(evaluate(colour, {})).toBe(palette.land);
  }
});

it("outlines dark fills in their own tone and leaves light fills as the provider outlined them", () => {
  const fill = (source: string, dark: boolean) =>
    transformed(
      {
        id: "x",
        type: "fill",
        source: "v",
        "source-layer": source,
        paint: { "fill-opacity": 0.5 },
      },
      dark,
    ).paint;
  const dark = mapPalette(true);
  expect(fill("water", true)).toEqual({
    "fill-opacity": 0.5,
    "fill-color": dark.water,
    "fill-outline-color": dark.water,
  });
  expect(fill("building", true)).toEqual({
    "fill-opacity": 0.5,
    "fill-color": dark.building,
    "fill-outline-color": dark.roadEdge,
  });
  expect(fill("building", false)).toEqual({
    "fill-opacity": 0.5,
    "fill-color": mapPalette(false).building,
  });
});

it("adds three-quarter-pixel road casings while preserving zoom widths", () => {
  const width: DataDrivenPropertyValueSpecification<number> = {
    type: "exponential",
    stops: [
      [5, 1],
      [12, 8],
    ],
  };
  const road = (id: string, paint?: Record<string, unknown>) => ({
    id,
    type: "line",
    source: "v",
    "source-layer": "roads",
    ...(paint && { paint }),
  });
  const style = styleOf(
    road("wide", { "line-width": width }),
    road("plain"),
    { ...road("openmaptiles"), "source-layer": "transportation" },
    // Road names share the roads' layer, and take no casing.
    { id: "name", type: "symbol", source: "v", "source-layer": "roads" },
  );
  const before = structuredClone(style);
  const result = transformBasemapStyle(style, false);
  expect(style).toEqual(before);
  expect(result.layers.map((layer) => layer.id)).toEqual([
    "wide-cast-iron-edge",
    "wide",
    "plain-cast-iron-edge",
    "plain",
    "openmaptiles-cast-iron-edge",
    "openmaptiles",
    "name",
  ]);
  expect(result.layers[0].paint).toEqual({
    "line-width": 0.75,
    "line-gap-width": width,
    "line-color": "#d6d1c6",
  });
  expect(result.layers[1].paint).toEqual({
    "line-width": width,
    "line-color": "#ffffff",
  });
  expect(result.layers[2].paint).toMatchObject({ "line-gap-width": 1 });
});

it("keeps the provider's style when the style is not one, or reading it fails", () => {
  for (const style of [
    { version: 8, layers: [] },
    { version: 8, sources: [], layers: [] },
    { version: 8, sources: {}, layers: null },
    "style",
  ])
    expect(transformBasemapStyle(style as unknown as StyleSpecification)).toBe(
      style,
    );
  const failing = styleOf({
    get id(): string {
      throw Error("unforeseen");
    },
  });
  expect(transformBasemapStyle(failing, false)).toBe(failing);
});

it("leaves place names to the app's badges until the pin threshold, then names them in Japanese", () => {
  const place = (minzoom?: number, source = "places") =>
    transformed(
      {
        id: "city",
        type: "symbol",
        source: "v",
        "source-layer": source,
        layout: { "text-field": ["get", "name:en"], "text-size": 12 },
        ...(minzoom === undefined ? {} : { minzoom }),
      },
      false,
    );
  expect(place(undefined, "place")).toEqual({
    ...place(),
    "source-layer": "place",
  });
  expect(place()).toMatchObject({
    minzoom: 7,
    layout: {
      "text-field": ["coalesce", ["get", "name:ja"], ["get", "name"]],
      "text-size": 12,
    },
  });
  expect(place(3).minzoom).toBe(7);
  expect(place(10).minzoom).toBe(10);
  // Other labels keep their own zoom range and text.
  const poi = transformed(
    {
      id: "poi",
      type: "symbol",
      source: "v",
      "source-layer": "poi",
      layout: { "text-field": ["get", "name:en"] },
    },
    false,
  );
  expect(poi.minzoom).toBeUndefined();
  expect(poi.layout).toEqual({ "text-field": ["get", "name:en"] });
});

it.each(["watername_ocean", "watername_sea"])(
  "names %s in Japanese only, and drops the seas without a Japanese name",
  (id) => {
    const filter: FilterSpecification = ["==", ["get", "kind"], "sea"];
    const sea = (extra: Record<string, unknown>, dark: boolean) =>
      transformed(
        {
          id,
          type: "symbol",
          source: "carto",
          "source-layer": "water_name",
          layout: { "text-field": ["get", "name"], "text-size": 12 },
          ...extra,
        },
        dark,
      );
    for (const dark of themes) {
      const filtered = sea({ filter, paint: { "text-opacity": 0.5 } }, dark);
      expect(filtered.layout).toEqual({
        "text-field": ["get", "name:ja"],
        "text-size": 12,
      });
      expect(filtered.filter).toEqual(["all", filter, ["has", "name:ja"]]);
      expect(filtered.paint).toEqual({
        "text-opacity": 0.5,
        "text-color": mapPalette(dark).label,
        "text-halo-color": mapPalette(dark).paper,
      });
      expect(sea({}, dark).filter).toEqual(["has", "name:ja"]);
    }
    // Only a label is renamed: another layer with the id stays as it is.
    const line = {
      id,
      type: "line",
      source: "carto",
      "source-layer": "water_name",
    };
    expect(transformBasemapStyle(styleOf(line), false).layers[0]).toBe(line);
  },
);

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
    { id: 3, type: "background" },
    { id: "numeric-source", type: "background", "source-layer": 3 },
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
  const other = { type: "vector", attribution: "© Example" };
  const style = {
    version: 8,
    sources: { carto, numeric, other },
    layers: [
      ...odd,
      { id: "water", type: "fill", source: "v", "source-layer": "water" },
    ],
  } as unknown as StyleSpecification;
  const before = structuredClone(style);
  const result = transformBasemapStyle(style, false);
  expect(result.layers.slice(0, odd.length)).toEqual(odd);
  expect(result.layers.at(-1)?.paint).toMatchObject({
    "fill-color": expect.any(String),
  });
  expect(result.sources.numeric).toEqual(numeric);
  expect(result.sources.other).toEqual(other);
  // CARTO's attribution page, without the link to report a map problem.
  expect(result.sources.carto).toEqual({
    type: "vector",
    attribution: '<a href="https://carto.com/attributions">CARTO</a>',
  });
  expect(style).toEqual(before);
});

/** A map whose style was transformed for `dark`, and its repaint. */
function repainted(dark: boolean, ...layers: unknown[]) {
  const fake = fakeMapLibre({
    basemap: [
      ...transformBasemapStyle(styleOf(...layers), dark).layers,
      // Not the basemap's: the app paints its own layers.
      {
        id: "app",
        type: "circle",
        source: "app",
        paint: { "circle-color": "#123456" },
      },
    ],
  });
  return { fake, repaint: basemapRepaint(fake.maplibre) };
}
const boundary = (id: string, color: string) => ({
  id,
  type: "line",
  source: "v",
  "source-layer": "boundaries",
  paint: { "line-color": color, "line-width": 2 },
});

it.each(themes)(
  "repaints the basemap for the OS theme and returns to the provider's paint in light (initial dark=%s)",
  (initial) => {
    const { fake, repaint } = repainted(
      initial,
      { id: "land", type: "background" },
      {
        id: "building",
        type: "fill",
        source: "v",
        "source-layer": "buildings",
        paint: { "fill-color": "#eeeeee", "fill-outline-color": "#dddddd" },
      },
      { id: "road", type: "line", source: "v", "source-layer": "roads" },
      boundary("boundary_state", "#ead5d7"),
      boundary("boundary_country_outline", "#f3efed"),
      {
        id: "landuse-line",
        type: "line",
        source: "v",
        "source-layer": "landuse",
        paint: { "line-color": "#cccccc" },
      },
      {
        id: "border-names",
        type: "symbol",
        source: "v",
        "source-layer": "boundaries",
        paint: { "text-opacity": 0.5 },
      },
    );
    // Repainting the basemap preserves later changes to unrelated layers.
    fake.maplibre.setPaintProperty("app", "circle-color", "#654321");
    fake.maplibre.setPaintProperty("border-names", "text-opacity", 1);
    const colours = () => ({
      app: fake.layer("circle", "app").paint?.["circle-color"],
      borderNames: fake.layer("symbol", "border-names").paint?.["text-opacity"],
      land: fake.layer("background", "land").paint?.["background-color"],
      building: fake.layer("fill", "building").paint,
      road: fake.layer("line", "road").paint?.["line-color"],
      edge: fake.layer("line", "road-cast-iron-edge").paint?.["line-color"],
      state: fake.layer("line", "boundary_state").paint,
      outline: fake.layer("line", "boundary_country_outline").paint,
      landuse: fake.layer("line", "landuse-line").paint?.["line-color"],
    });
    const light = mapPalette(false);
    const dark = mapPalette(true);
    const inLight = {
      app: "#654321",
      borderNames: 1,
      land: light.land,
      building: {
        "fill-color": light.building,
        "fill-outline-color": "#dddddd",
      },
      road: light.road,
      edge: light.roadEdge,
      state: { "line-color": "#ead5d7", "line-width": 2 },
      outline: { "line-color": "#f3efed", "line-width": 2 },
      landuse: "#cccccc",
    };
    const inDark = {
      app: "#654321",
      borderNames: 1,
      land: dark.land,
      building: {
        "fill-color": dark.building,
        "fill-outline-color": dark.roadEdge,
      },
      road: dark.road,
      edge: dark.roadEdge,
      state: { "line-color": dark.boundary, "line-width": 2 },
      // A casing in the land's colour keeps the line apart from the terrain.
      outline: { "line-color": dark.land, "line-width": 2 },
      landuse: dark.road,
    };
    expect(colours()).toEqual(initial ? inDark : inLight);
    repaint(!initial);
    expect(colours()).toEqual(initial ? inLight : inDark);
    repaint(initial);
    expect(colours()).toEqual(initial ? inDark : inLight);
  },
);
