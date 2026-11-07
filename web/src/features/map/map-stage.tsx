import { Component, Suspense, lazy, type ReactNode } from "react";
import type { CardMapProps } from "./card-map";

// Start fetching the map code alongside card data. The immediate rejection
// handler keeps a failed chunk from becoming an unhandled promise rejection.
const mapModule = import("./card-map").then(
  (module) => ({ module }),
  (error: unknown) => ({ error }),
);
const CardMap = lazy(async () => {
  const result = await mapModule;
  if ("error" in result) throw result.error;
  return result.module;
});
class MapBoundary extends Component<
  { children: ReactNode; onError: (message: string) => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error) {
    this.props.onError(String(error));
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export function MapStage(props: CardMapProps) {
  return (
    <MapBoundary onError={props.onError}>
      <Suspense
        fallback={
          <div className="map-loading" aria-hidden="true">
            地図を準備しています
          </div>
        }
      >
        <CardMap {...props} />
      </Suspense>
    </MapBoundary>
  );
}
