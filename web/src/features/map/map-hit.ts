import { isJsonObject } from "./json-object";
import { featureCardIds } from "./mapcn-data";

// The map's boundary for hit tests: queryRenderedFeatures returns whatever the
// queried layers render. A feature becomes a target only if its geometry and
// properties have the shape the layers are built with (pinsGeoJSON and
// countsGeoJSON); anything else is not selectable. Hit tests run per click and
// pointer move, so these only read a few fields.

export type PinTarget = {
  id: string;
  cardIds: string[];
  lngLat: [number, number];
};
export type BadgeTarget = {
  kind: "area" | "pref";
  id: string;
  lngLat: [number, number];
};

function located(feature: unknown) {
  if (!isJsonObject(feature) || !isJsonObject(feature.properties)) return null;
  const { geometry, properties } = feature;
  if (!isJsonObject(geometry) || geometry.type !== "Point") return null;
  const coordinates: unknown = geometry.coordinates;
  if (!Array.isArray(coordinates)) return null;
  const [lng, lat]: unknown[] = coordinates;
  if (typeof lng !== "number" || typeof lat !== "number") return null;
  if (typeof properties.id !== "string") return null;
  return {
    id: properties.id,
    properties,
    lngLat: [lng, lat] satisfies [number, number],
  };
}

/** A pin (place or lid) with the cards it opens. */
export function pinTarget(feature: unknown): PinTarget | null {
  const hit = located(feature);
  if (!hit) return null;
  const cardIds = featureCardIds(hit);
  return cardIds.length ? { id: hit.id, cardIds, lngLat: hit.lngLat } : null;
}

/** A national or regional count badge, or its area label. */
export function badgeTarget(feature: unknown): BadgeTarget | null {
  const hit = located(feature);
  const kind = hit?.properties.kind;
  return hit && (kind === "area" || kind === "pref")
    ? { kind, id: hit.id, lngLat: hit.lngLat }
    : null;
}

/** The targets among hit features, in MapLibre's topmost-first order. */
export function targets<T>(
  features: readonly unknown[],
  read: (feature: unknown) => T | null,
): T[] {
  const result: T[] = [];
  for (const feature of features) {
    const target = read(feature);
    if (target) result.push(target);
  }
  return result;
}
