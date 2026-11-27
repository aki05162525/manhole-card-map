import { readMapFocus } from "../../features/map/map-history";
import { mapSearchScreen, readMapSearch } from "./map-search-state";

// What the map restores as it starts, from its URL and its history entry,
// read with the functions the page reads it with: the HTML's own drawing
// of the national level (`first-stage.ts`) is shown, and takes presses,
// only where the page opens at that same picture.

/** The friend whose map the URL names: none without accounts. */
export function friendInUrl(search: string, accounts: boolean) {
  return accounts ? new URLSearchParams(search).get("friend") : null;
}

/**
 * Whether the map opens at `href` with the history entry's `state` on the
 * national level with the public counts and nothing over it, as the HTML
 * draws it. Each of these opens elsewhere, or over it:
 * - a card in the URL: its detail (`use-map-url-state.ts`), or the notice
 *   that names it as not found, a value left empty or given twice, which
 *   moves the drawing down;
 * - the search the entry keeps open, a modal over the map
 *   (`map-search-state.ts`);
 * - a friend in the URL: the friend's header and counts (`map-page.tsx`);
 * - a region or a prefecture the entry keeps (`use-map-navigation.ts`).
 * The rest of the entry goes with these: the sheet's size and the way back
 * from a detail with a card, the camera a hand zoom-out left with a level,
 * and the words last searched with the search, which the page's bar shows
 * once it has started.
 */
export function opensNationally(
  href: string,
  state: unknown,
  accounts: boolean,
) {
  const url = new URL(href);
  return (
    !url.searchParams.has("card") &&
    mapSearchScreen(readMapSearch(state), null) === "M" &&
    friendInUrl(url.search, accounts) === null &&
    readMapFocus(state).area === null
  );
}
