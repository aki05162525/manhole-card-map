import { useEffect, useState } from "react";
import { readMapFocus, withMapFocus } from "../../features/map/map-history";
import type { MapFocus } from "../../features/map/map-levels";
import {
  flushHistoryWrites,
  routeHistory,
} from "../../shared/browser/app-history";
const entries = routeHistory("map");
export function useMapNavigation() {
  const [focus, setFocus] = useState<MapFocus>({ area: null, pref: null });
  const changeFocus = (next: MapFocus) => {
    if (next.area === focus.area && next.pref === focus.pref) return;
    flushHistoryWrites();
    entries.push({
      ...withMapFocus(entries.state(), next),
      mapCardNavigation: null,
    });
    setFocus(next);
  };
  useEffect(
    () => entries.subscribe(() => setFocus(readMapFocus(entries.state()))),
    [],
  );
  return { focus, changeFocus };
}
