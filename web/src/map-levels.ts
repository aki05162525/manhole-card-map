import type { FeatureCollection, Point } from "geojson";
import { areas, prefectures } from "./prefectures";

export const REGION_MAX_ZOOM = 5.6;
export const PIN_MIN_ZOOM = 7;
export type MapFocus = { area: string | null; pref: string | null };
export type Badge = {
  kind: "area" | "pref";
  id: string;
  name: string;
  badge: [number, number];
};
export function visibleBadges(zoom: number, focus: MapFocus): Badge[] {
  if (zoom >= PIN_MIN_ZOOM) return [];
  return [
    ...areas
      .filter((a) => zoom < REGION_MAX_ZOOM && a.id !== focus.area)
      .map((a) => ({
        kind: "area" as const,
        id: a.id,
        name: a.name,
        badge: a.badge,
      })),
    ...prefectures
      .filter(
        (p) =>
          p.name !== focus.pref &&
          (zoom >= REGION_MAX_ZOOM || p.area === focus.area),
      )
      .map((p) => ({
        kind: "pref" as const,
        id: p.name,
        name: p.name,
        badge: p.badge,
      })),
  ];
}
export function pinVisibility(
  zoom: number,
  focus: MapFocus,
  pinPref: string,
): "normal" | "dim" | "hidden" {
  if (zoom >= PIN_MIN_ZOOM)
    return !focus.pref || focus.pref === pinPref ? "normal" : "dim";
  return focus.pref === pinPref ? "normal" : "hidden";
}
export function countPins(pins: { pref: string }[]) {
  const prefs: Record<string, number> = Object.fromEntries(
    prefectures.map((p) => [p.name, 0]),
  );
  const areaCounts: Record<string, number> = Object.fromEntries(
    areas.map((a) => [a.id, 0]),
  );
  for (const pin of pins) {
    const p = prefectures.find((p) => p.name === pin.pref);
    if (!p) continue;
    prefs[p.name]++;
    areaCounts[p.area]++;
  }
  return { prefs, areas: areaCounts };
}
export function focusForAreaTap(area: string): MapFocus {
  const a = areas.find((a) => a.id === area);
  return a
    ? { area: a.id, pref: a.prefs.length === 1 ? a.prefs[0] : null }
    : { area: null, pref: null };
}
export function focusForPrefTap(pref: string): MapFocus {
  const p = prefectures.find((p) => p.name === pref);
  return p ? { area: p.area, pref: p.name } : { area: null, pref: null };
}
export function parentFocus(focus: MapFocus): MapFocus {
  if (focus.pref) {
    const p = prefectures.find((p) => p.name === focus.pref);
    const a = areas.find((a) => a.id === p?.area);
    if (a && a.prefs.length > 1) return { area: a.id, pref: null };
  }
  return { area: null, pref: null };
}
type CountProperties = {
  kind: "area" | "pref";
  id: string;
  name: string;
  count: number;
};
export function countsGeoJSON(
  zoom: number,
  focus: MapFocus,
  counts: ReturnType<typeof countPins>,
): FeatureCollection<Point, CountProperties> {
  return {
    type: "FeatureCollection",
    features: visibleBadges(zoom, focus).map((b) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [...b.badge] },
      properties: {
        kind: b.kind,
        id: b.id,
        name: b.name,
        count: (b.kind === "area" ? counts.areas : counts.prefs)[b.id] ?? 0,
      },
    })),
  };
}

export function pinFilter(
  zoom: number,
  focus: MapFocus,
  kind: "lid" | "place",
): import("maplibre-gl").FilterSpecification {
  if (zoom < PIN_MIN_ZOOM && (kind === "lid" || !focus.pref))
    return ["==", 1, 0];
  const base: import("maplibre-gl").FilterSpecification = [
    "==",
    ["get", "kind"],
    kind,
  ];
  return zoom >= PIN_MIN_ZOOM
    ? base
    : ["all", base, ["==", ["get", "pref"], focus.pref!]];
}
export function tapAction(count: number, zoom: number) {
  return count <= 8 || zoom >= 17.5 ? "select" : "zoom";
}
