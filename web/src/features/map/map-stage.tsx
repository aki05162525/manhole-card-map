import { Suspense, lazy } from "react";
import { MapBoundary } from "./map-boundary";
import type { CardMapProps } from "./card-map";

let engine: Promise<typeof import("./card-map")> | null = null;
/**
 * Reads the map's code, which reads MapLibre as it loads
 * (`components/ui/map.tsx`): one load, asked for as soon as the first view
 * can be used (`pages/map/use-map-engine.ts`), and taken by the map when it
 * is created. A failure is the map's to tell, when it is created.
 */
export function readMapEngine() {
  engine ??= import("./card-map");
  return engine;
}
const CardMap = lazy(readMapEngine);
/** The map that moves, created once `start` is true. */
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
