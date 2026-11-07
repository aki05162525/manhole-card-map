import type { FeatureCollection, Point, LineString } from "geojson";
import {
  REGION_MAX_ZOOM,
  PIN_MIN_ZOOM,
  areaBordersEmphasized,
  prefectureBordersEmphasized,
  type MapFocus,
} from "./map-levels";
import { prefectures } from "../../prefectures";
import type { Map as MapLibreMap, ExpressionSpecification } from "maplibre-gl";
import { colors } from "./types";
import { type Pin } from "../../domain/types";

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

// Keep the entire original paint/filter below z7, including legacy camera
// functions. A copy avoids nesting zoom expressions inside other expressions.
export const LOW_BORDER_LAYER = "pref-borders-basemap-low";
type BorderPaintMap = Pick<
  MapLibreMap,
  "getStyle" | "addLayer" | "setLayerZoomRange" | "setPaintProperty"
>;
export function emphasizePrefectureBorders(map: BorderPaintMap) {
  const layer = map.getStyle().layers.find((l) => l.id === "boundary_state");
  if (!layer || layer.type !== "line") return;
  map.addLayer(
    { ...layer, id: LOW_BORDER_LAYER, maxzoom: PIN_MIN_ZOOM },
    layer.id,
  );
  map.setLayerZoomRange(layer.id, PIN_MIN_ZOOM, layer.maxzoom ?? 24);
  map.setPaintProperty(layer.id, "line-color", "#7d6a78");
  map.setPaintProperty(layer.id, "line-width", 1.2);
  map.setPaintProperty(layer.id, "line-dasharray", [1, 0]);
  return () => {
    if (!map.getStyle()?.layers.some((l) => l.id === layer.id)) return;
    map.setLayerZoomRange(layer.id, layer.minzoom ?? 0, layer.maxzoom ?? 24);
    for (const name of ["line-color", "line-width", "line-dasharray"] as const)
      map.setPaintProperty(layer.id, name, layer.paint?.[name]);
  };
}
export type BorderData = FeatureCollection<LineString, { p: [string, string] }>;
export function isAreaBorder(pair: [string, string]) {
  return (
    prefectures.find((p) => p.code === pair[0])?.area !==
    prefectures.find((p) => p.code === pair[1])?.area
  );
}
// Failure is optional decoration only. Keep it out of the map error event path.
export async function loadBorderData(
  url: string,
  install: (data: BorderData) => void,
  request: typeof fetch = fetch,
) {
  try {
    const response = await request(url);
    if (!response.ok) return;
    const data: BorderData = await response.json();
    install(data);
  } catch {
    /* The map and pins remain usable without these lines. */
  }
}
export const BORDER_SOURCE = "pref-border-lines";
export const BORDER_LAYERS = ["pref-borders", "area-borders"];
type BorderMap = Pick<
  MapLibreMap,
  | "getLayer"
  | "getStyle"
  | "addSource"
  | "addLayer"
  | "setPaintProperty"
  | "setLayoutProperty"
  | "setLayerZoomRange"
>;
export function installBorderLayers(map: BorderMap, data: BorderData) {
  map.addSource(BORDER_SOURCE, {
    type: "geojson",
    data: {
      ...data,
      features: data.features.map((f) => ({
        ...f,
        properties: { ...f.properties, area: isAreaBorder(f.properties.p) },
      })),
    },
  });
  // Below basemap labels, roads/pins and all app badges remain legible.
  const before =
    map.getStyle().layers.find((l) => l.type === "symbol")?.id ??
    "card-level-counts";
  for (const id of BORDER_LAYERS)
    map.addLayer(
      {
        id,
        type: "line",
        source: BORDER_SOURCE,
        maxzoom: PIN_MIN_ZOOM,
        ...(id === "area-borders"
          ? {
              maxzoom: REGION_MAX_ZOOM,
              filter: ["==", ["get", "area"], true] as ExpressionSpecification,
            }
          : {}),
        layout: {
          "line-join": "round",
          "line-cap": "round",
          visibility: "none",
        },
        paint: {
          "line-color": "#7d6a78",
          "line-width": 1.2,
          "line-opacity-transition": { duration: 0, delay: 0 },
        },
      },
      before,
    );
  // Only after the optional source succeeds, stop the pale copy before the
  // complete own lines. Its paint and low zoom filter stay entirely intact.
  const low = map.getStyle().layers.find((l) => l.id === LOW_BORDER_LAYER);
  if (low) map.setLayerZoomRange(low.id, low.minzoom ?? 0, REGION_MAX_ZOOM);
  let previous: string | undefined;
  return (focus: MapFocus) => {
    const key = focus.area === null ? "national" : "area";
    if (key === previous) return;
    previous = key;
    map.setLayoutProperty("pref-borders", "visibility", "visible");
    map.setPaintProperty(
      "pref-borders",
      "line-opacity",
      prefectureBordersEmphasized(0, focus)
        ? 1
        : ["step", ["zoom"], 0, REGION_MAX_ZOOM, 1],
    );
    map.setLayoutProperty(
      "area-borders",
      "visibility",
      areaBordersEmphasized(0, focus) ? "visible" : "none",
    );
  };
}
