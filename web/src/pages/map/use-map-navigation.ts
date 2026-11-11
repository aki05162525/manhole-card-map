import { useEffect, useState } from "react";
import { focusFromHistory } from "../../features/map/map-history";
import type { MapFocus } from "../../features/map/map-levels";
export function useMapNavigation() {
  const [focus, setFocus] = useState<MapFocus>({ area: null, pref: null });
  const changeFocus = (next: MapFocus) => {
    if (next.area === focus.area && next.pref === focus.pref) return;
    history.pushState(
      { ...history.state, mapCardNavigation: null, mapFocus: next },
      "",
    );
    setFocus(next);
  };
  useEffect(() => {
    const pop = (event: PopStateEvent) => {
      // SPIKE(keep-map-alive): the catalog in this document owns /cards entries.
      if (location.pathname === "/cards") return;
      setFocus(focusFromHistory(event.state));
    };
    window.addEventListener("popstate", pop);
    return () => window.removeEventListener("popstate", pop);
  }, []);
  return { focus, changeFocus };
}
