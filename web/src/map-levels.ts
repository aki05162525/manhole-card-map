import type { FeatureCollection, Point } from "geojson";
import { areas, prefectures, type Bounds } from "./prefectures";

export const REGION_MAX_ZOOM = 5.6;
export const PIN_MIN_ZOOM = 7;
export const JAPAN: Bounds = [
  [127, 26],
  [146, 46],
];
export type MapFocus = {
  area: string | null;
  pref: string | null;
  preserveCamera?: boolean;
};
export type Badge = {
  kind: "area" | "pref";
  id: string;
  name: string;
  badge: [number, number];
};
// Keep borders dark after counts give way to pins, including an open area below
// the national count threshold. A selected prefecture does not change this rule.
export function prefectureBordersEmphasized(
  zoom: number,
  focus: MapFocus,
): boolean {
  return zoom >= REGION_MAX_ZOOM || focus.area !== null;
}
export function areaBordersEmphasized(zoom: number, focus: MapFocus): boolean {
  return zoom < REGION_MAX_ZOOM && focus.area === null;
}
export function visibleBadges(zoom: number, focus: MapFocus): Badge[] {
  if (zoom >= PIN_MIN_ZOOM) return [];
  return [
    ...areas
      .filter(() => areaBordersEmphasized(zoom, focus))
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
  if (zoom < PIN_MIN_ZOOM && (kind === "lid" || !focus.pref)) return false;
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

export function focusChanged(before: MapFocus, after: MapFocus) {
  return before.area !== after.area || before.pref !== after.pref;
}
// An area must stay below PIN_MIN_ZOOM on wide screens: its prefecture counts are the next step.
// A prefecture fits its pins inside the mainland bounds: mountains without pins
// would shrink the view, and remote islands stay visible as pins.
export function focusCamera(
  focus: Pick<MapFocus, "area" | "pref">,
  pins: { pref: string; lng: number; lat: number }[] = [],
): {
  bounds: Bounds;
  maxZoom: number;
} {
  const pref = prefectures.find((p) => p.name === focus.pref);
  if (pref) {
    const [[w, s], [e, n]] = pref.bounds;
    const inside = pins.filter(
      (p) =>
        p.pref === pref.name &&
        p.lng >= w &&
        p.lng <= e &&
        p.lat >= s &&
        p.lat <= n,
    );
    return {
      bounds: inside.length
        ? [
            [
              Math.min(...inside.map((p) => p.lng)),
              Math.min(...inside.map((p) => p.lat)),
            ],
            [
              Math.max(...inside.map((p) => p.lng)),
              Math.max(...inside.map((p) => p.lat)),
            ],
          ]
        : pref.bounds,
      maxZoom: 11,
    };
  }
  const area = areas.find((a) => a.id === focus.area);
  return { bounds: area?.bounds ?? JAPAN, maxZoom: PIN_MIN_ZOOM - 0.1 };
}
// A hand zoom-out returns to numbers. A view that opens below the boundary, like
// Hokkaido, stays open until it is clearly smaller than where it opened.
const CLOSE_MARGIN = 0.5;
export function focusAfterZoomOut(
  zoom: number,
  focus: MapFocus,
  openedZoom: number,
): MapFocus {
  const boundary = focus.pref
    ? PIN_MIN_ZOOM
    : focus.area
      ? REGION_MAX_ZOOM
      : -Infinity;
  return zoom < Math.min(boundary, openedZoom - CLOSE_MARGIN)
    ? parentFocus(focus)
    : focus;
}
