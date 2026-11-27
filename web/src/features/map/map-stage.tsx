import { Suspense, lazy } from "react";
import { MapBoundary } from "./map-boundary";
import type { CardMapProps } from "./card-map";

// Read when the map is first started: MapLibre and the map's code wait for
// the first view (`pages/map/use-map-engine.ts`).
const CardMap = lazy(() => import("./card-map"));
/** The map that moves, read and created once `start` is true. */
export function MapStage({
  start,
  ...props
}: CardMapProps & { start: boolean }) {
  if (!start) return null;
  return (
    <MapBoundary onError={props.onError}>
      <Suspense fallback={null}>
        <CardMap {...props} />
      </Suspense>
    </MapBoundary>
  );
}
