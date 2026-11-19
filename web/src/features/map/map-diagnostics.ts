import type { Map as MapLibreMap } from "maplibre-gl";
import { badgeTarget, pinTarget } from "./map-hit";
import { COUNTS, POINTS } from "./map-resources";

export function mapDiagnostics(
  map: MapLibreMap,
  disposed: () => boolean,
  duration: () => number,
) {
  return {
    view: () => ({
      lat: map.getCenter().lat,
      lng: map.getCenter().lng,
      zoom: map.getZoom(),
    }),
    async exercise() {
      map.jumpTo({ center: [139.76, 35.68], zoom: 7 });
      for (let i = 0; i < 6 && !disposed(); i++) {
        map.panBy([i % 2 ? 80 : -80, 30], { duration: duration() });
        await new Promise((r) => setTimeout(r, 500));
        if (disposed()) break;
        map.zoomTo(i % 2 ? 7 : 8, { duration: duration() });
        await new Promise((r) => setTimeout(r, 500));
      }
    },
    tapPoint(id?: string) {
      const canvas = map.getCanvas();
      const rect = canvas.getBoundingClientRect();
      for (const feature of map.queryRenderedFeatures({
        layers: [...POINTS, COUNTS],
      })) {
        const target = pinTarget(feature) ?? badgeTarget(feature);
        if (!target || (id && target.id !== id)) continue;
        const point = map.project(target.lngLat);
        // Measurement scripts add #map's rectangle. Skip points hidden by UI.
        if (
          document.elementFromPoint(point.x + rect.left, point.y + rect.top) ===
          canvas
        ) {
          return { x: point.x, y: point.y };
        }
      }
      return null;
    },
  };
}
