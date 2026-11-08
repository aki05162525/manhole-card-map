import { useCallback, useEffect, useRef, useState } from "react";
import { metrics } from "../../shared/browser/explorer-metrics";
import { painted } from "../../shared/browser/painted";
import { type Adapter } from "./types";

export function useMapController() {
  const adapterRef = useRef<Adapter | undefined>(undefined);
  const [mapState, setMapState] = useState<"loading" | "ready" | "failed">(
    "loading",
  );
  const [locating, setLocating] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    const diagnostics = {
      metrics,
      painted,
      get adapter() {
        return adapterRef.current;
      },
    };
    Object.assign(window, { prototype: diagnostics });
    return () => {
      adapterRef.current = undefined;
    };
  }, []);
  const mapError = useCallback((error: string) => {
    metrics.errors.push(error);
    setMapState("failed");
  }, []);
  const mapWarning = useCallback(() => {
    setMessage(
      "背景の一部を読み込めませんでした。地図の移動とカードの選択は引き続き使えます。",
    );
  }, []);
  const mapReady = useCallback((adapter: Adapter) => {
    adapterRef.current = adapter;
    setMapState("ready");
    void painted().then(() => {
      metrics.ready = performance.now();
      performance.mark("map-ready");
      performance.measure("map-render", "map-create", "map-ready");
      performance.measure("startup", { start: 0, end: "map-ready" });
    });
  }, []);

  function locate() {
    if (!("geolocation" in navigator)) {
      setMessage(
        "この端末では現在地を取得できません。一覧から探してください。",
      );
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        adapterRef.current?.locate(
          position.coords.latitude,
          position.coords.longitude,
        );
        setLocating(false);
        setMessage("");
      },
      () => {
        setLocating(false);
        setMessage("現在地を取得できなかったため、表示中の範囲を使います。");
      },
      { timeout: 8000 },
    );
  }
  return {
    adapterRef,
    mapState,
    message,
    mapError,
    mapWarning,
    mapReady,
    locate,
    locating,
  };
}
