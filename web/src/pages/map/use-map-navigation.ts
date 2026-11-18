import { useEffect, useState } from "react";
import { readMapFocus, withMapFocus } from "../../features/map/map-history";
import type { MapFocus } from "../../features/map/map-levels";
import {
  flushHistoryWrites,
  routeHistory,
} from "../../shared/browser/app-history";
const entries = routeHistory("map");
/**
 * The level the current entry holds, for a map created now. `preserveCamera`
 * keeps the camera a hand zoom-out left, and a new map has no such camera:
 * it opens over the whole level instead.
 */
function openingFocus(): MapFocus {
  const { area, pref } = readMapFocus(entries.state());
  return { area, pref };
}
export function useMapNavigation() {
  const [focus, setFocus] = useState(openingFocus);
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
