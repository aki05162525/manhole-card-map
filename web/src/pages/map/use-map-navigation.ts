import { useEffect, useState } from "react";
import { focusFromHistory } from "../../features/map/map-history";
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
      ...(entries.state() as object | null),
      mapCardNavigation: null,
      mapFocus: next,
    });
    setFocus(next);
  };
  useEffect(
    () =>
      entries.subscribe(() =>
        setFocus(
          focusFromHistory(entries.state() as { mapFocus?: MapFocus } | null),
        ),
      ),
    [],
  );
  return { focus, changeFocus };
}
