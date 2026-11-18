import {
  Component,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { transitionMap, type MapPhase } from "./mapcn-lifecycle";
import type { CardMapProps } from "./card-map";
import type { Adapter } from "./types";
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

type Callbacks = Pick<CardMapProps, "onError" | "onWarning" | "onReady">;

/**
 * The map's lifecycle as its owner hears it: ready once, a failure before
 * that or a fatal one as an error, a later one as a warning, and an error
 * when it has not loaded in time. `failed` takes the map away.
 */
export function useMapFailure(props: Callbacks) {
  const [failed, setFailed] = useState(false);
  // The map's listeners outlive a render: they call the props of the latest
  // one committed.
  const callbacks = useRef(props);
  useLayoutEffect(() => {
    callbacks.current = props;
  });
  const phase = useRef<MapPhase>("loading");
  const report = useCallback(
    (message: string, fatal: boolean, to: Callbacks) => {
      const next = transitionMap(phase.current, fatal ? "fatal" : "error");
      phase.current = next.state;
      if (next.notification === "error") {
        setFailed(true);
        to.onError(message);
      } else if (next.notification === "warning") {
        to.onWarning?.(message);
      }
    },
    [],
  );
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (phase.current !== "loading") return;
      phase.current = "failed";
      setFailed(true);
      callbacks.current.onError("地図の読み込みが時間内に完了しませんでした。");
    }, 20000);
    return () => clearTimeout(timeout);
  }, []);
  const onError = useCallback(
    (message: string) => report(message, false, callbacks.current),
    [report],
  );
  // A render that throws is caught before the layout effect above runs: the
  // boundary tells the props of that render, not the ref.
  const onFatal = (message: string) => report(message, true, props);
  const onReady = useCallback((adapter: Adapter) => {
    const next = transitionMap(phase.current, "ready");
    phase.current = next.state;
    if (next.notification === "ready") callbacks.current.onReady(adapter);
  }, []);
  return { failed, onError, onFatal, onReady };
}
