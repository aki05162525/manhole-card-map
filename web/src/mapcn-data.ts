import type { FeatureCollection, Point } from "geojson";
import { colors, type Pin } from "./types";

type CardFeature = { properties: Record<string, unknown> | null };
export function pinsGeoJSON(pins: Pin[]): FeatureCollection<Point> {
  return {
    type: "FeatureCollection",
    features: pins.map((pin) => ({
      type: "Feature",
      id: pin.id,
      geometry: { type: "Point", coordinates: [pin.lng, pin.lat] },
      properties: {
        id: pin.id,
        pref: pin.pref,
        cardIds: JSON.stringify(pin.cardIds),
        kind: pin.kind,
        status: pin.status,
        reference: pin.reference,
        color: colors[pin.status],
      },
    })),
  };
}
export function featureCardIds(feature: CardFeature): string[] {
  try {
    const ids: unknown =
      typeof feature.properties?.cardIds === "string"
        ? JSON.parse(feature.properties.cardIds)
        : feature.properties?.cardIds;
    return Array.isArray(ids)
      ? [...new Set(ids.filter((id): id is string => typeof id === "string"))]
      : [];
  } catch {
    return [];
  }
}
// The basemap draws prefecture borders as a pale dashed line, hard to tell from
// municipal ones. Other basemaps may lack this layer: VITE_MAP_STYLE_URL swaps it.
export function emphasizePrefectureBorders(map: {
  getLayer(id: string): unknown;
  setPaintProperty(id: string, name: string, value: unknown): unknown;
}) {
  const layer = "boundary_state";
  if (!map.getLayer(layer)) return;
  map.setPaintProperty(layer, "line-color", "#7d6a78");
  map.setPaintProperty(layer, "line-width", {
    stops: [
      [4, 0.6],
      [7, 1.2],
      [10, 1.8],
    ],
  });
  map.setPaintProperty(layer, "line-dasharray", [1, 0]);
}
