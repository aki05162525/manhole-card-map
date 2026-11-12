import { useCallback, useEffect, useRef, useState } from "react";
import { metrics } from "../../shared/browser/explorer-metrics";
import { painted } from "../../shared/browser/painted";
import { useScreenActive } from "../../shared/browser/screen-activity";
import { type Adapter } from "./types";

export function useMapController() {
  const adapterRef = useRef<Adapter | undefined>(undefined);
  const [mapState, setMapState] = useState<"loading" | "ready" | "failed">(
    "loading",
  );
  const [locating, setLocating] = useState(false);
  const [message, setMessage] = useState("");
  // The browser refused location, so the notice explains how to allow it.
  const [locationDenied, setLocationDenied] = useState(false);
  const hideTimer = useRef<number | undefined>(undefined);
  const active = useRef(true);
  active.current = useScreenActive();
  const dismissMessage = useCallback(() => {
    clearTimeout(hideTimer.current);
    setMessage("");
    setLocationDenied(false);
  }, []);
  useEffect(() => () => clearTimeout(hideTimer.current), []);
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
    setLocationDenied(false);
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
    dismissMessage();
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        // Arrived behind another screen: a press on return asks again,
        // rather than the map jumping to an old position then.
        if (active.current)
          adapterRef.current?.locate(
            position.coords.latitude,
            position.coords.longitude,
          );
        setLocating(false);
      },
      (error) => {
        setLocating(false);
        if (error.code === error.PERMISSION_DENIED) {
          setLocationDenied(true);
          setMessage("位置情報の利用が許可されていません。");
          return;
        }
        setMessage("現在地を取得できませんでした。もう一度お試しください。");
        hideTimer.current = window.setTimeout(dismissMessage, 5000);
      },
      { timeout: 8000 },
    );
  }
  return {
    adapterRef,
    mapState,
    message,
    locationDenied,
    dismissMessage,
    mapError,
    mapWarning,
    mapReady,
    locate,
    locating,
  };
}
