import { PIN_MIN_ZOOM } from "./map-levels";
import type { LayerSpecification, StyleSpecification } from "maplibre-gl";

// Palette mirrors the design tokens; WebGL paint cannot resolve CSS variables.
const palette = {
  land: "#efede8",
  water: "#cdd6d5",
  building: "#e0dcd2",
  green: "#e6e8df",
  road: "#ffffff",
  roadEdge: "#d6d1c6",
  label: "#595c58",
  paper: "#f3f1ec",
};
function transformLayer(layer: LayerSpecification): LayerSpecification {
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
        paint: { ...layer.paint, "fill-color": color },
      } as LayerSpecification;
  }
  if (layer.type === "line" && source === "water")
    return { ...layer, paint: { ...layer.paint, "line-color": palette.water } };
  if (
    layer.type === "line" &&
    ["transportation", "roads"].includes(source ?? "")
  ) {
    return { ...layer, paint: { ...layer.paint, "line-color": palette.road } };
  }

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
): StyleSpecification {
  try {
    return {
      ...style,
      layers: style.layers.flatMap((layer) => {
        const next = transformLayer(layer);
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
