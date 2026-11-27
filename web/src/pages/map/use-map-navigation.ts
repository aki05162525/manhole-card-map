import { useEffect, useLayoutEffect, useState } from "react";
import { readMapFocus, withMapFocus } from "../../features/map/map-history";
import { focusForAreaTap, type MapFocus } from "../../features/map/map-levels";
import { areas } from "../../prefectures";
import {
  flushHistoryWrites,
  routeHistory,
} from "../../shared/browser/app-history";
import { clearEarlyChoice, earlyChoice } from "./early-choice";
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
/**
 * A region pressed on the HTML's drawing before this script had loaded
 * (`first-stage.ts`): the page opens it, as if pressed on the stage that
 * replaces the drawing.
 */
function earlyFocus(): MapFocus | null {
  const area = earlyChoice();
  return area && areas.some((a) => a.id === area)
    ? focusForAreaTap(area)
    : null;
}
function pushFocus(next: MapFocus) {
  flushHistoryWrites();
  entries.push({
    ...withMapFocus(entries.state(), next),
    mapCardNavigation: null,
  });
}
export function useMapNavigation() {
  const [early] = useState(earlyFocus);
  const [focus, setFocus] = useState(() => early ?? openingFocus());
  const changeFocus = (next: MapFocus) => {
    if (next.area === focus.area && next.pref === focus.pref) return;
    pushFocus(next);
    setFocus(next);
  };
  // The region pressed early becomes an entry of its own, once.
  useLayoutEffect(() => {
    if (early && clearEarlyChoice()) pushFocus(early);
  }, [early]);
  useEffect(
    () => entries.subscribe(() => setFocus(readMapFocus(entries.state()))),
    [],
  );
  /** Whether the page opened at a region pressed on the HTML's drawing. */
  return { focus, changeFocus, openedEarly: early !== null };
}
