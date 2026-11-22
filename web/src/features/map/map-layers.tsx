import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";
import { useMap } from "../../components/ui/map";
import { useScreenActive } from "../../shared/browser/screen-activity";
import type { CardMapProps } from "./card-map";
import { createMapRuntime, type MapOpening } from "./map-runtime";

export function MapLayers({
  opening,
  ...props
}: CardMapProps & { opening: RefObject<MapOpening | null> }) {
  // The app's layers go in with the style: the pins and the counts are
  // drawn while the basemap's tiles still load.
  const { map, isStyleLoaded: isLoaded } = useMap();
  // The map's listeners outlive a render: they read the props of the
  // latest one committed.
  const callbacks = useRef(props);
  useLayoutEffect(() => {
    callbacks.current = props;
  });
  const runtime = useRef<ReturnType<typeof createMapRuntime> | null>(null);
  // Hidden behind another screen, the map takes no data and stops its
  // camera, and its adapter ignores late calls, so it draws and fetches
  // nothing more; the latest data applies when it is shown again. Its
  // container keeps its size meanwhile (`app/`).
  const active = useScreenActive();
  const shown = useRef(active);
  useEffect(() => {
    if (!map) return;
    const instance = createMapRuntime(
      map,
      () => callbacks.current,
      () => opening.current,
    );
    instance.hide(!shown.current);
    runtime.current = instance;
    if (isLoaded) instance.initialize();
    return () => {
      runtime.current = null;
      instance.dispose();
    };
  }, [map, isLoaded, opening]);
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
