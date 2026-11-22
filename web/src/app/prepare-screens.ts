import { useEffect, type RefObject } from "react";
import {
  accountRead,
  friendsRead,
  type PrivateRead,
} from "../contract/private-api";
import { readAhead } from "../session/private-reads";
import type { HistoryRoute } from "../shared/browser/app-history";
import { MENU_OPEN } from "../shared/ui/site-menu";
import { switchTarget } from "./screen-links";
import type { Screen, Screens } from "./screens";

// What each screen reads first, read ahead of it while signed in.
const firstRead: Partial<Record<HistoryRoute, PrivateRead<unknown>>> = {
  friends: friendsRead,
  account: accountRead,
};

/**
 * Before a switch is asked for: the screen's chunk, and while signed in its
 * first private read (`readAhead` goes through a session guard and never
 * asks twice). The map's chunk is heavy: only when its link is pressed or
 * focused, not on a pointer passing or the menu opening.
 */
export function usePrepareScreens(
  latest: RefObject<{ route: HistoryRoute; screens: Screens }>,
  settings: RefObject<{ load: (route: HistoryRoute) => Promise<Screen> }>,
) {
  useEffect(() => {
    const loading = new Map<HistoryRoute, Promise<unknown>>();
    const prepare = (route: HistoryRoute | null, map: boolean) => {
      if (!route || (route === "map" && !map)) return;
      if (!latest.current.screens[route] && !loading.has(route))
        loading.set(
          route,
          settings.current.load(route).catch(() => loading.delete(route)),
        );
      const read = firstRead[route];
      if (read && import.meta.env.VITE_ACCOUNTS_ENABLED === "true")
        readAhead(read);
    };
    const linked = (target: EventTarget | null) =>
      switchTarget(target, latest.current.route)?.route ?? null;
    const pressed = (event: Event) => prepare(linked(event.target), true);
    const passed = (event: Event) => prepare(linked(event.target), false);
    const opened = (event: Event) => {
      if (event.target instanceof Element)
        for (const link of event.target
          .closest(".site-menu")
          ?.querySelectorAll("a[href]") ?? [])
          prepare(linked(link), false);
    };
    document.addEventListener("pointerdown", pressed);
    document.addEventListener("focusin", pressed);
    document.addEventListener("pointerover", passed);
    document.addEventListener(MENU_OPEN, opened);
    return () => {
      document.removeEventListener("pointerdown", pressed);
      document.removeEventListener("focusin", pressed);
      document.removeEventListener("pointerover", passed);
      document.removeEventListener(MENU_OPEN, opened);
    };
  }, [latest, settings]);
}
