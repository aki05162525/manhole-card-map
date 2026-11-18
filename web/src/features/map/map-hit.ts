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

// MapLibre hands each feature's cardIds back as the JSON string pinsGeoJSON
// wrote. A pointer moving over one pin reads the same string on every move, so
// the last string and its ids are kept.
let lastCardIds: { serialized: string; ids: string[] } | undefined;
function cardIdsOf(hit: NonNullable<ReturnType<typeof located>>) {
  const serialized = hit.properties.cardIds;
  if (typeof serialized !== "string") return featureCardIds(hit);
  if (lastCardIds?.serialized !== serialized)
    lastCardIds = { serialized, ids: featureCardIds(hit) };
  return lastCardIds.ids;
}
function pinOf(hit: NonNullable<ReturnType<typeof located>>) {
  const cardIds = cardIdsOf(hit);
  return cardIds.length
    ? { id: hit.id, cardIds: [...cardIds], lngLat: hit.lngLat }
    : null;
}

/** A pin (place or lid) with the cards it opens. */
export function pinTarget(feature: unknown): PinTarget | null {
  const hit = located(feature);
  return hit && pinOf(hit);
}

/** Whether any hit feature is a pin, as pinTarget reads it. */
export function hasPin(features: readonly unknown[]) {
  return features.some((feature) => {
    const hit = located(feature);
    return hit !== null && cardIdsOf(hit).length > 0;
  });
}

/**
 * The pin nearest by `distance`; ties keep MapLibre's topmost-first order.
 * Positions are read first and card ids nearest first, so a tap usually
 * parses one pin's ids however many pins the box hits.
 */
export function nearestPin(
  features: readonly unknown[],
  distance: (lngLat: [number, number]) => number,
): PinTarget | null {
  const hits = [];
  for (const feature of features) {
    const hit = located(feature);
    if (hit) hits.push({ hit, distance: distance(hit.lngLat) });
  }
  // A stable sort, so equal distances stay topmost first.
  hits.sort((a, b) => a.distance - b.distance);
  for (const { hit } of hits) {
    const pin = pinOf(hit);
    if (pin) return pin;
  }
  return null;
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
