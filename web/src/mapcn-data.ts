import type { FeatureCollection, Point } from "geojson";
import { prefectureBordersEmphasized, type MapFocus } from "./map-levels";
import type { FilterSpecification } from "maplibre-gl";
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
// Only used with the default CARTO style. Its zoom<6 macroregion filter hides
// Japan's kind_detail=4 region boundaries even though z5 tiles contain them.
export function emphasizePrefectureBorders(map: {
  getLayer(id: string): unknown;
  setFilter(id: string, filter: FilterSpecification): unknown;
  setPaintProperty(id: string, name: string, value: unknown): unknown;
}) {
  const layer = "boundary_state";
  let previous: boolean | undefined;
  return (zoom: number, focus: MapFocus) => {
    if (!map.getLayer(layer)) return;
    const emphasized = prefectureBordersEmphasized(zoom, focus);
    if (emphasized === previous) return;
    if (previous === undefined) {
      map.setFilter(layer, ["==", ["get", "kind_detail"], 4]);
      for (const name of ["line-color-transition", "line-width-transition"])
        map.setPaintProperty(layer, name, { duration: 0, delay: 0 });
      map.setPaintProperty(layer, "line-opacity", 1);
      map.setPaintProperty(layer, "line-dasharray", [1, 0]);
    }
    map.setPaintProperty(
      layer,
      "line-color",
      emphasized ? "#7d6a78" : "#ead5d7",
    );
    map.setPaintProperty(layer, "line-width", emphasized ? 1.2 : 0.5);
    previous = emphasized;
  };
}
