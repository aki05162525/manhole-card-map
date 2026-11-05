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
export async function clusterCardIds(
  source: {
    getClusterLeaves(
      id: number,
      limit: number,
      offset: number,
    ): Promise<CardFeature[]>;
  },
  clusterId: number,
  count: number,
): Promise<string[]> {
  const ids = new Set<string>();
  for (let offset = 0; offset < count; offset += 100) {
    const leaves = await source.getClusterLeaves(clusterId, 100, offset);
    if (!leaves.length) break;
    for (const feature of leaves)
      for (const id of featureCardIds(feature)) ids.add(id);
  }
  return [...ids];
}
