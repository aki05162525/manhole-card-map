import {
  historyRoute,
  latestEntry,
  type HistoryRoute,
} from "../shared/browser/app-history";
import {
  mergeCatalogHistoryState,
  readMapCardUrl,
} from "../shared/url/catalog-url";
import { kept } from "./screens";

/** Which links and URLs switch screens, and where such a switch lands. */

const friendOf = (url: URL) =>
  import.meta.env.VITE_ACCOUNTS_ENABLED === "true"
    ? url.searchParams.get("friend")
    : null;
// LINE's in-app browser cannot use passkeys; as a document, the Worker sends
// these pages to the default browser (`worker/external-browser.ts`).
const inLine = () => /\bLine\//.test(navigator.userAgent);
/**
 * The screen a URL of this site shows, unless it is left to the browser: the
 * recovery step, a link asking LINE for the default browser, and, inside
 * LINE, the friends and the account.
 */
function screenRoute(url: URL) {
  const route = historyRoute(url.pathname);
  if (
    !route ||
    url.searchParams.has("openExternalBrowser") ||
    (route === "account" && url.searchParams.has("recover")) ||
    ((route === "friends" || route === "account") && inLine())
  )
    return null;
  return route;
}
/** Another screen, or the map of another person than the one shown. */
const switches = (route: HistoryRoute, url: URL, shown: HistoryRoute) =>
  route !== shown ||
  (route === "map" && friendOf(url) !== friendOf(new URL(location.href)));

/** The screen `url` switches to from `shown`, if it does. */
export function switchRoute(url: URL, shown: HistoryRoute) {
  const route = url.origin === location.origin ? screenRoute(url) : null;
  return route && switches(route, url, shown) ? route : null;
}

/** The link at `target` and the screen it switches to, if it does. */
export function switchTarget(target: EventTarget | null, shown: HistoryRoute) {
  const link = target instanceof Element ? target.closest("a[href]") : null;
  if (
    !(link instanceof HTMLAnchorElement) ||
    (link.target && link.target !== "_self") ||
    link.hasAttribute("download")
  )
    return null;
  const url = new URL(link.href);
  const route = switchRoute(url, shown);
  return route ? { link, route, url } : null;
}

/** A plain click on a link to another screen; anything else is the browser's. */
export function switchLink(event: MouseEvent, shown: HistoryRoute) {
  if (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  )
    return null;
  const found = switchTarget(event.target, shown);
  if (!found) return null;
  // The site's own navigation goes back to a screen; a link in the content
  // means the place it names.
  const returning = Boolean(found.link.closest("header, nav"));
  return { route: found.route, url: found.url, returning };
}

const omit = (state: unknown, keys: string[]) =>
  Object.fromEntries(
    Object.entries(state && typeof state === "object" ? state : {}).filter(
      ([key]) => !keys.includes(key),
    ),
  );
/**
 * Where a link to `route` lands. The site navigation's bare `/` or `/cards`
 * returns to that screen's last entry as it was left, a full sheet aside;
 * the map with a card or of a friend keeps its level and selects the card;
 * anything else starts fresh at the link's URL. The site's own `/` after a
 * friend's map is one's own map, at the level left.
 */
export function landing(route: HistoryRoute, url: URL, returning: boolean) {
  const last = kept(route) ? latestEntry(route) : null;
  const friend = route === "map" && last && friendOf(new URL(last.url));
  if (last && !friend && returning && !url.search && !url.hash)
    return {
      url: last.url,
      state: route === "map" ? omit(last.state, ["sheet"]) : last.state,
      left: last.id,
    };
  if (route === "map" && last)
    return {
      url: url.href,
      state: mergeCatalogHistoryState(
        omit(last.state, [
          "appEntry",
          "sheet",
          "mapSearch",
          "mapCardNavigation",
        ]),
        { card: readMapCardUrl(url).card },
      ),
      left: null,
    };
  return { url: url.href, state: {}, left: null };
}
