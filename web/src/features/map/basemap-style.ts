import { PIN_MIN_ZOOM } from "./map-levels";
import type { LayerSpecification, StyleSpecification } from "maplibre-gl";

import { mapPalette, systemDark } from "./map-theme";
/** CARTO's labels for seas and oceans; they lie over the Japan mask. */
export const SEA_LABELS = ["watername_ocean", "watername_sea"];
function transformLayer(
  layer: LayerSpecification,
  palette: ReturnType<typeof mapPalette>,
): LayerSpecification {
  const originalPaint = (
    layer.metadata as Record<string, unknown> | undefined
  )?.["cast-iron-light-paint"] as typeof layer.paint | undefined;
  const source = "source-layer" in layer ? layer["source-layer"] : "";
  if (layer.type === "background")
    return {
      ...layer,
      paint: { ...layer.paint, "background-color": palette.land },
    };
  if (layer.type === "fill") {
    const color =
      source === "water"
        ? palette.water
        : ["building", "buildings"].includes(source ?? "")
          ? palette.building
          : ["landcover", "park"].includes(source ?? "")
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
          ...(layer.metadata as Record<string, unknown> | undefined),
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
      } as LayerSpecification;
  }
  if (
    layer.type === "line" &&
    ["boundaries", "landuse"].includes(source ?? "")
  ) {
    // Retain upstream paint so a dark -> light change restores the exact light
    // map, including the provider's camera functions and boundary casings.
    const metadata = layer.metadata as Record<string, unknown> | undefined;
    const original = metadata?.["cast-iron-light-paint"] as typeof layer.paint;
    if (palette === mapPalette(false))
      return original ? { ...layer, paint: original } : layer;
    return {
      ...layer,
      metadata: {
        ...metadata,
        "cast-iron-light-paint": original ?? layer.paint,
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
  if (
    layer.type === "line" &&
    ["transportation", "roads"].includes(source ?? "")
  ) {
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
    } as LayerSpecification;
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
    ].includes(source ?? "")
  ) {
    return {
      ...layer,
      // App badges own place names until the pin stage.
      ...(["place", "places"].includes(source ?? "")
        ? { minzoom: Math.max(PIN_MIN_ZOOM, layer.minzoom ?? 0) }
        : {}),
      ...(["place", "places"].includes(source ?? "")
        ? {
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
export function transformBasemapStyle(
  style: StyleSpecification,
  dark = systemDark(),
): StyleSpecification {
  const palette = mapPalette(dark);
  try {
    return {
      ...style,
      sources: Object.fromEntries(
        Object.entries(style.sources).map(([id, source]) => [
          id,
          "attribution" in source &&
          source.attribution?.includes("https://carto.com/about-carto/")
            ? {
                ...source,
                attribution: source.attribution.replaceAll(
                  "https://carto.com/about-carto/",
                  "https://carto.com/attributions",
                ),
              }
            : source,
        ]),
      ),
      layers: style.layers.flatMap((layer) => {
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
      }),
    };
  } catch {
    return style;
  }
}

// Repaint in place so OS changes preserve camera, selection and loaded sources.
export function basemapRepaint(
  map: Pick<import("maplibre-gl").Map, "getStyle" | "setPaintProperty">,
) {
  const original = map.getStyle().layers;
  return (dark: boolean) => {
    const current = new Map(
      map.getStyle().layers.map((layer) => [layer.id, layer.paint]),
    );
    for (const layer of original) {
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
        map.setPaintProperty(
          layer.id,
          name as Parameters<typeof map.setPaintProperty>[1],
          (next.paint as Record<string, unknown> | undefined)?.[
            name
          ] as Parameters<typeof map.setPaintProperty>[2],
        );
    }
  };
}
