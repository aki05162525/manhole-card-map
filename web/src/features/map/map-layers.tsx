import { useEffect, useRef } from "react";
import { useMap } from "../../components/ui/map";
import { useScreenActive } from "../../shared/browser/screen-activity";
import type { CardMapProps } from "./card-map";
import { createMapRuntime } from "./map-runtime";

export function MapLayers(props: CardMapProps) {
  const { map, isLoaded } = useMap();
  const callbacks = useRef(props);
  callbacks.current = props;
  const runtime = useRef<ReturnType<typeof createMapRuntime> | null>(null);
  // Hidden behind another screen, the map takes no data and stops its
  // camera, and its adapter ignores late calls, so it draws and fetches
  // nothing more; the latest data applies when it is shown again. Its
  // container keeps its size meanwhile (`app/`).
  const active = useScreenActive();
  const shown = useRef(active);
  useEffect(() => {
    if (!map) return;
    const instance = createMapRuntime(map, () => callbacks.current);
    instance.hide(!shown.current);
    runtime.current = instance;
    if (isLoaded) instance.initialize();
    return () => {
      runtime.current = null;
      instance.dispose();
    };
  }, [map, isLoaded]);
  useEffect(() => {
    if (!map || shown.current === active) return;
    shown.current = active;
    runtime.current?.hide(!active);
    if (!active) map.stop();
    else {
      map.resize();
      map.triggerRepaint();
    }
  }, [map, active]);
  useEffect(() => {
    if (isLoaded && active) runtime.current?.sync(props);
  }, [props, map, isLoaded, active]);
  return null;
}
