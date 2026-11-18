import { PIN_MIN_ZOOM } from "./map-levels";
import type { StyleSpecification } from "maplibre-gl";

import { isJsonObject } from "./json-object";
import { mapPalette, systemDark } from "./map-theme";
/** CARTO's labels for seas and oceans; they lie over the Japan mask. */
export const SEA_LABELS = ["watername_ocean", "watername_sea"];

// The style arrives from the basemap provider (VITE_MAP_STYLE_URL) and reaches
// transformStyle before MapLibre validates it. The transform reads only the
// fields below; a layer or source with another shape is passed on untouched so
// MapLibre, the style's validator, judges it and reports a broken style as a
// map error (the list and search keep working). Dropping it here would hide a
// provider change behind a silently thinner map.
type Json = Record<string, unknown>;
type BasemapLayer = Json & {
  id: string;
  type: string;
  "source-layer"?: string;
  paint?: Json;
  layout?: Json;
  metadata?: Json;
  minzoom?: number;
};
function isBasemapLayer(value: unknown): value is BasemapLayer {
  if (!isJsonObject(value)) return false;
  const { id, type, paint, layout, metadata, minzoom } = value;
  const sourceLayer = value["source-layer"];
  return (
    typeof id === "string" &&
    typeof type === "string" &&
    (sourceLayer === undefined || typeof sourceLayer === "string") &&
    (paint === undefined || isJsonObject(paint)) &&
    (layout === undefined || isJsonObject(layout)) &&
    (metadata === undefined || isJsonObject(metadata)) &&
    (minzoom === undefined || typeof minzoom === "number")
  );
}
/** The provider's paint, kept in metadata so a dark -> light change restores it. */
function lightPaint(layer: BasemapLayer): Json | undefined {
  const paint = layer.metadata?.["cast-iron-light-paint"];
  return isJsonObject(paint) ? paint : undefined;
}
function transformLayer(
  layer: BasemapLayer,
  palette: ReturnType<typeof mapPalette>,
): BasemapLayer {
  const originalPaint = lightPaint(layer);
  const source = layer["source-layer"] ?? "";
  if (layer.type === "background")
    return {
      ...layer,
      paint: { ...layer.paint, "background-color": palette.land },
    };
  if (layer.type === "fill") {
    const color =
      source === "water"
        ? palette.water
        : ["building", "buildings"].includes(source)
          ? palette.building
          : ["landcover", "park"].includes(source)
            ? palette.green
            : source === "landuse"
              ? [
                  "match",
                  ["coalesce", ["get", "class"], ["get", "kind"], ""],
                  [
                    "park",
                    "forest",
                    "wood",
                    "grass",
                    "grassland",
                    "nature_reserve",
                    "national_park",
                  ],
                  palette.green,
                  palette.land,
                ]
              : undefined;
    if (color)
      return {
        ...layer,
        metadata: {
          ...layer.metadata,
          "cast-iron-light-paint": originalPaint ?? layer.paint,
        },
        paint: {
          ...(originalPaint ?? layer.paint),
          "fill-color": color,
          ...(palette === mapPalette(true)
            ? {
                "fill-outline-color":
                  source === "water" ? palette.water : palette.roadEdge,
              }
            : {}),
        },
      };
  }
  if (layer.type === "line" && ["boundaries", "landuse"].includes(source)) {
    // Retain upstream paint so a dark -> light change restores the exact light
    // map, including the provider's camera functions and boundary casings.
    if (palette === mapPalette(false))
      return originalPaint ? { ...layer, paint: originalPaint } : layer;
    return {
      ...layer,
      metadata: {
        ...layer.metadata,
        "cast-iron-light-paint": originalPaint ?? layer.paint,
      },
      paint: {
        ...layer.paint,
        "line-color":
          source === "landuse"
            ? palette.road
            : layer.id.endsWith("_outline")
              ? palette.land
              : palette.boundary,
      },
    };
  }
  if (layer.type === "line" && source === "water")
    return { ...layer, paint: { ...layer.paint, "line-color": palette.water } };
  if (layer.type === "line" && ["transportation", "roads"].includes(source)) {
    return {
      ...layer,
      paint: {
        ...layer.paint,
        "line-color": layer.id.endsWith("-cast-iron-edge")
          ? palette.roadEdge
          : palette.road,
      },
    };
  }

  // Names of seas only in Japanese: the mask hides the neighbours' coasts,
  // and other languages' names for the same water would read as a stray label.
  if (layer.type === "symbol" && SEA_LABELS.includes(layer.id))
    return {
      ...layer,
      ...(layer.filter
        ? { filter: ["all", layer.filter, ["has", "name:ja"]] }
        : { filter: ["has", "name:ja"] }),
      layout: { ...layer.layout, "text-field": ["get", "name:ja"] },
      paint: {
        ...layer.paint,
        "text-color": palette.label,
        "text-halo-color": palette.paper,
      },
    };
  if (
    layer.type === "symbol" &&
    [
      "place",
      "places",
      "water",
      "waterway",
      "transportation_name",
      "roads",
      "poi",
      "pois",
      "building",
      "buildings",
    ].includes(source)
  ) {
    return {
      ...layer,
      // App badges own place names until the pin stage.
      ...(["place", "places"].includes(source)
        ? {
            minzoom: Math.max(PIN_MIN_ZOOM, layer.minzoom ?? 0),
            layout: {
              ...layer.layout,
              "text-field": ["coalesce", ["get", "name:ja"], ["get", "name"]],
            },
          }
        : {}),
      paint: {
        ...layer.paint,
        "text-color": palette.label,
        "text-halo-color": palette.paper,
      },
    };
  }
  return layer;
}
function transformSource(source: unknown) {
  if (!isJsonObject(source) || typeof source.attribution !== "string")
    return source;
  return {
    ...source,
    attribution: source.attribution.replaceAll(
      "https://carto.com/about-carto/",
      "https://carto.com/attributions",
    ),
  };
}
function transformLayers(layers: readonly unknown[], dark: boolean) {
  const palette = mapPalette(dark);
  return layers.flatMap((layer) => {
    if (!isBasemapLayer(layer)) return [layer];
    const next = transformLayer(layer, palette);
    if (
      next.type !== "line" ||
      !["transportation", "roads"].includes(next["source-layer"] ?? "")
    )
      return [next];
    // A three-quarter-pixel casing around the existing width, including camera
    // functions. Keep zoom expressions at the property root for MapLibre.
    return [
      {
        ...next,
        id: `${next.id}-cast-iron-edge`,
        paint: {
          ...next.paint,
          "line-gap-width": next.paint?.["line-width"] ?? 1,
          "line-width": 0.75,
          "line-color": palette.roadEdge,
        },
      },
      next,
    ];
  });
}
export function transformBasemapStyle(
  style: StyleSpecification,
  dark = systemDark(),
): StyleSpecification {
  const raw: unknown = style;
  if (
    !isJsonObject(raw) ||
    !isJsonObject(raw.sources) ||
    !Array.isArray(raw.layers)
  )
    return style;
  const { sources, layers } = raw;
  // The app passes a style URL, and MapLibre reports an exception thrown here
  // as a map error without loading the style. Only the colours fail then, so
  // an unforeseen failure keeps the map with the provider's own style.
  try {
    const next = {
      ...raw,
      sources: Object.fromEntries(
        Object.entries(sources).map(([id, source]) => [
          id,
          transformSource(source),
        ]),
      ),
      layers: transformLayers(layers, dark),
    };
    // Only paint, layout, filter, minzoom, metadata, casing layers and CARTO's
    // attribution change, each to a value MapLibre accepts; MapLibre then
    // validates the whole style before loading it.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    return next as StyleSpecification;
  } catch {
    return style;
  }
}

// Repaint in place so OS changes preserve camera, selection and loaded sources.
export function basemapRepaint(
  map: Pick<import("maplibre-gl").Map, "getStyle" | "setPaintProperty">,
) {
  const original: readonly unknown[] = map.getStyle().layers;
  // Names and values come from the style's own paint, and MapLibre validates
  // each setPaintProperty; its typed signature cannot name them statically.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  const setPaint = map.setPaintProperty.bind(map) as (
    layerId: string,
    name: string,
    value: unknown,
  ) => void;
  return (dark: boolean) => {
    const layers: readonly unknown[] = map.getStyle().layers;
    const current = new Map(
      layers.filter(isBasemapLayer).map((layer) => [layer.id, layer.paint]),
    );
    for (const layer of original) {
      if (!isBasemapLayer(layer)) continue;
      const next = transformLayer(layer, mapPalette(dark));
      if (next === layer || !next.paint) {
        // After dark, restore provider paint even if the light transform is a no-op.
        if (
          layer.type !== "line" ||
          !["boundaries", "landuse"].includes(layer["source-layer"] ?? "")
        )
          continue;
      }
      for (const name of new Set([
        ...Object.keys(current.get(layer.id) ?? {}),
        ...Object.keys(next.paint ?? {}),
      ]))
        setPaint(layer.id, name, next.paint?.[name]);
    }
  };
}
