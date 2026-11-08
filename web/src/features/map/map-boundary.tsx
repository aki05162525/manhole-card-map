import { Component, useEffect, useRef, useState, type ReactNode } from "react";
import { transitionMap, type MapPhase } from "./mapcn-lifecycle";
import type { CardMapProps } from "./card-map";
export class MapBoundary extends Component<
  { children: ReactNode; onError(message: string): void },
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

export function MapFailureBoundary(
  props: Pick<CardMapProps, "onError" | "onWarning" | "onReady"> & {
    children: (
      callbacks: Pick<CardMapProps, "onError" | "onReady">,
    ) => ReactNode;
  },
) {
  const [failed, setFailed] = useState(false);
  const callbacks = useRef(props);
  callbacks.current = props;
  const phase = useRef<MapPhase>("loading");
  const reportError = (message: string, fatal = false) => {
    const next = transitionMap(phase.current, fatal ? "fatal" : "error");
    phase.current = next.state;
    if (next.notification === "error") {
      setFailed(true);
      callbacks.current.onError(message);
    } else if (next.notification === "warning") {
      callbacks.current.onWarning?.(message);
    }
  };
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (phase.current !== "loading") return;
      phase.current = "failed";
      setFailed(true);
      callbacks.current.onError("地図の読み込みが時間内に完了しませんでした。");
    }, 20000);
    return () => clearTimeout(timeout);
  }, []);
  if (failed) return null;
  return (
    <MapBoundary onError={(message) => reportError(message, true)}>
      {props.children({
        onError: reportError,
        onReady(adapter) {
          const next = transitionMap(phase.current, "ready");
          phase.current = next.state;
          if (next.notification === "ready") callbacks.current.onReady(adapter);
        },
      })}
    </MapBoundary>
  );
}
