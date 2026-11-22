import { dismissOnGesture } from "./map-dismiss";
import { badgeTarget, hasPin, nearestPin, targets } from "./map-hit";
import type { Map as MapLibreMap, MapMouseEvent } from "maplibre-gl";
import type { CardMapProps } from "./card-map";
import { COUNT_NAMES, COUNTS, POINTS } from "./map-resources";
import {
  REGION_MAX_ZOOM,
  focusForAreaTap,
  focusForPrefTap,
  type MapFocus,
} from "./map-levels";

export function bindMapInteractions(
  map: MapLibreMap,
  readProps: () => CardMapProps,
  getFocus: () => MapFocus,
) {
  const badgeAt = (point: MapMouseEvent["point"]) => {
    if (map.getZoom() >= REGION_MAX_ZOOM || getFocus().area !== null)
      return targets(
        map.queryRenderedFeatures(point, { layers: [COUNTS] }),
        badgeTarget,
      )[0];
    const { x, y } = point;
    const candidates = targets(
      map.queryRenderedFeatures(
        [
          [x - 22, y - 22],
          [x + 22, y + 22],
        ],
        { layers: [COUNTS] },
      ),
      badgeTarget,
    );
    let nearest: (typeof candidates)[number] | undefined;
    let distance = Infinity;
    for (const badge of candidates) {
      const centre = map.project(badge.lngLat);
      const d = (centre.x - x) ** 2 + (centre.y - y) ** 2;
      if (d <= 22 ** 2 && d < distance) {
        nearest = badge;
        distance = d;
      }
    }
    if (nearest) return nearest;
    // A style without glyphs has no names, and MapLibre reports a query of
    // a missing layer as a map error.
    if (!map.getLayer(COUNT_NAMES.area)) return undefined;
    return targets(
      map.queryRenderedFeatures(point, {
        layers: [COUNT_NAMES.area],
      }),
      badgeTarget,
    )[0];
  };
  const click = (event: MapMouseEvent) => {
    const badge = badgeAt(event.point);
    if (badge) {
      readProps().onFocus(
        badge.kind === "area"
          ? focusForAreaTap(badge.id)
          : focusForPrefTap(badge.id),
      );
      return;
    }
    const { x, y } = event.point;
    const nearest = nearestPin(
      map.queryRenderedFeatures(
        [
          [x - 12, y - 12],
          [x + 12, y + 12],
        ],
        { layers: POINTS },
      ),
      (lngLat) => {
        const point = map.project(lngLat);
        return (point.x - x) ** 2 + (point.y - y) ** 2;
      },
    );
    if (!nearest) {
      readProps().onDismiss?.();
      return;
    }
    readProps().onSelect(nearest.cardIds, nearest.id);
  };
  const hover = (event: MapMouseEvent) => {
    map.getCanvas().style.cursor =
      badgeAt(event.point) ||
      hasPin(map.queryRenderedFeatures(event.point, { layers: POINTS }))
        ? "pointer"
        : "";
  };
  const gesture = (event: {
    type?: string;
    fromApp?: boolean;
    originalEvent?: unknown;
  }) => {
    const { width, height } = map.getContainer().getBoundingClientRect();
    if (dismissOnGesture(width, height, event)) readProps().onDismiss?.();
  };
  map.on("zoomstart", gesture);
  map.on("click", click);
  map.on("mousemove", hover);
  return () => {
    map.off("zoomstart", gesture);
    map.off("click", click);
    map.off("mousemove", hover);
  };
}
