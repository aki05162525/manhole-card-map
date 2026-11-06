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
