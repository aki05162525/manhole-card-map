import { useEffect, useRef } from "react";
import { useMap } from "../../components/ui/map";
import type { CardMapProps } from "./card-map";
import { createMapRuntime } from "./map-runtime";

export function MapLayers(props: CardMapProps) {
  const { map, isLoaded } = useMap();
  const callbacks = useRef(props);
  callbacks.current = props;
  const runtime = useRef<ReturnType<typeof createMapRuntime> | null>(null);
  useEffect(() => {
    if (!map) return;
    const instance = createMapRuntime(map, () => callbacks.current);
    runtime.current = instance;
    if (isLoaded) instance.initialize();
    return () => {
      runtime.current = null;
      instance.dispose();
    };
  }, [map, isLoaded]);
  useEffect(() => {
    if (isLoaded) runtime.current?.sync(props);
  }, [props, map, isLoaded]);
  return null;
}
