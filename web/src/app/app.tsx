import {
  Component,
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { preloadRecords, RecordsHost } from "../features/records/records-entry";
import {
  currentEntryId,
  currentRoute,
  historyRoute,
  latestEntry,
  onNavigate,
  onTraversal,
  switchScreen,
  type HistoryRoute,
} from "../shared/browser/app-history";
import { renderDocument } from "../shared/browser/render-document";
import { ScreenActivity } from "../shared/browser/screen-activity";
import { recheckSession, signedIn } from "../shared/browser/signed-in";
import { readAhead } from "../features/account/private-reads";
import { MENU_OPEN } from "../shared/ui/site-menu";
import {
  mergeCatalogHistoryState,
  readMapCardUrl,
} from "../shared/url/catalog-url";
import {
  applyDocumentMeta,
  readDocumentMeta,
  screenMeta,
  type DocumentMeta,
} from "./document-meta";
import "./app.css";

/**
 * The map, the catalog, the friends and the account share one document once
 * any of them is opened: links and back/forward between them switch screens
 * here, and the map stays alive behind the others. Each still starts from
 * its own HTML (`main.ts`, `cards-main.tsx`, `friends-main.tsx`,
 * `account-main.tsx`); every other page is a document navigation.
 */
type Screen = ComponentType;
type Screens = Partial<Record<HistoryRoute, Screen>>;
const ROUTES: HistoryRoute[] = ["map", "catalog", "friends", "account"];
/**
 * Kept mounted while another screen is shown. The friends and the account
 * unmount instead: what they held (recovery codes, a sign-in halfway, the
 * friends' list) is gone, and a return asks again.
 */
const kept = (route: HistoryRoute) => route === "map" || route === "catalog";

const loadScreen = async (route: HistoryRoute): Promise<Screen> =>
  (route === "map"
    ? await import("./map-screen")
    : route === "catalog"
      ? await import("./catalog-screen")
      : route === "friends"
        ? await import("./friends-screen")
        : await import("./account-screen")
  ).default;

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

/** The link at `target` and the screen it switches to, if it does. */
function switchTarget(target: EventTarget | null, shown: HistoryRoute) {
  const link = target instanceof Element ? target.closest("a[href]") : null;
  if (
    !(link instanceof HTMLAnchorElement) ||
    (link.target && link.target !== "_self") ||
    link.hasAttribute("download")
  )
    return null;
  const url = new URL(link.href);
  const route = url.origin === location.origin ? screenRoute(url) : null;
  return route && switches(route, url, shown) ? { link, route, url } : null;
}
// What each screen reads first, read ahead of it while signed in.
const firstRead: Partial<Record<HistoryRoute, string>> = {
  friends: "/api/friends",
  account: "/api/account",
};

/** A plain click on a link to another screen; anything else is the browser's. */
function switchLink(event: MouseEvent, shown: HistoryRoute) {
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
function landing(route: HistoryRoute, url: URL, returning: boolean) {
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

/** The browser's own animation where it has one and motion is welcome. */
function transition(update: () => void) {
  if (
    typeof document.startViewTransition !== "function" ||
    matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    update();
    return;
  }
  const running = document.startViewTransition(update);
  // A skipped animation still runs the update.
  running.ready.catch(() => {});
  running.finished.catch(() => {});
}

/** A screen that fails to render is opened as its own document instead. */
class ScreenBoundary extends Component<
  { onError(): void; children: ReactNode },
  { failed: boolean }
> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override componentDidCatch() {
    this.props.onError();
  }
  override render() {
    return this.state.failed ? null : this.props.children;
  }
}

function ScreenSlot({
  route,
  active,
  slots,
  children,
}: {
  route: HistoryRoute;
  active: boolean;
  slots: Map<HistoryRoute, HTMLElement>;
  children: ReactNode;
}) {
  return (
    <div
      ref={(element) => {
        if (element) slots.set(route, element);
        return () => {
          slots.delete(route);
        };
      }}
      className="app-screen"
      data-route={route}
      data-inactive={active ? undefined : ""}
      // The hidden map keeps its box (app.css); the catalog leaves the flow.
      hidden={!active && route === "catalog"}
      inert={!active}
    >
      <ScreenActivity value={active}>{children}</ScreenActivity>
    </div>
  );
}

type Kept = { scroll: number; focus: WeakRef<Element> | null };

export function App({
  initial,
  screens: given,
  meta,
  load = loadScreen,
  fallback = (href) => location.assign(href),
}: {
  initial: HistoryRoute;
  screens: Screens;
  meta: Record<HistoryRoute, DocumentMeta>;
  load?: (route: HistoryRoute) => Promise<Screen>;
  /** Where a link goes when its screen cannot be loaded. */
  fallback?: (href: string) => void;
}) {
  const [shown, setShown] = useState({ route: initial, screens: given });
  const latest = useRef(shown);
  latest.current = shown;
  const [slots] = useState(() => new Map<HistoryRoute, HTMLElement>());
  const settings = useRef({ meta, load, fallback });
  settings.current = { meta, load, fallback };
  // Once a switch has happened, the URL may name a screen this document did
  // not start with; one that fails then loads as its own document. Before,
  // a reload would only fail the same way.
  const switched = useRef(false);
  const [failed] = useState(() => () => {
    if (switched.current) settings.current.fallback(location.href);
  });
  useEffect(() => {
    // Scroll and focus of entries left for the other screen, by entry id.
    const remembered = new Map<string, Kept>();
    let pending = 0;
    const slot = (route: HistoryRoute) => slots.get(route) ?? null;
    /** Before a screen is hidden: what to give back when it returns. */
    const leave = (route: HistoryRoute): Kept => {
      const element = slot(route);
      if (element) {
        try {
          for (const popover of element.querySelectorAll<HTMLElement>(
            ":popover-open",
          ))
            popover.hidePopover();
        } catch {
          // Without the Popover API, the menu closes with its own script.
        }
        const box = element.firstElementChild?.getBoundingClientRect();
        if (box) {
          element.style.setProperty("--app-screen-width", `${box.width}px`);
          element.style.setProperty("--app-screen-height", `${box.height}px`);
        }
      }
      const active = document.activeElement;
      return {
        scroll: window.scrollY,
        focus:
          active && active !== document.body && element?.contains(active)
            ? new WeakRef(active)
            : null,
      };
    };
    /** Moves focus into the screen shown, for keyboards and readers. */
    const enter = (route: HistoryRoute, back: Kept | undefined) => {
      applyDocumentMeta(settings.current.meta[route]);
      const element = slot(route);
      if (!element) return;
      const restored = back?.focus?.deref();
      if (
        restored instanceof HTMLElement &&
        restored.isConnected &&
        element.contains(restored)
      ) {
        restored.focus({ preventScroll: true });
        if (document.activeElement === restored) return;
      }
      const heading =
        element.querySelector<HTMLElement>("h1") ??
        element.querySelector<HTMLElement>("main") ??
        element;
      if (!heading.hasAttribute("tabindex"))
        heading.setAttribute("tabindex", "-1");
      heading.focus({ preventScroll: true });
    };
    const show = (route: HistoryRoute, screen: Screen) =>
      setShown((shown) => ({
        route,
        screens: { ...shown.screens, [route]: screen },
      }));

    const follow = async (
      route: HistoryRoute,
      url: URL,
      returning: boolean,
    ) => {
      const from = latest.current.route;
      const token = ++pending;
      let screen = latest.current.screens[route];
      if (!screen) {
        try {
          screen = await settings.current.load(route);
        } catch {
          settings.current.fallback(url.href);
          return;
        }
      }
      if (token !== pending || latest.current.route !== from) return;
      // Whatever fails before the screen is shown, the link still goes.
      try {
        const target = landing(route, url, returning);
        // Another tab may have changed the user since this page was shown.
        recheckSession();
        const left = leave(from);
        transition(() => {
          if (token !== pending || currentRoute() !== from) return;
          switched.current = true;
          try {
            const moved = flushSync(() => {
              const moved = switchScreen({
                from,
                to: route,
                url: target.url,
                state: target.state,
              });
              if (moved) show(route, screen);
              return moved;
            });
            if (!moved) return;
            if (moved.id) remembered.set(moved.id, left);
            window.scrollTo(
              0,
              (target.left && remembered.get(target.left)?.scroll) || 0,
            );
            enter(route, undefined);
          } catch {
            settings.current.fallback(url.href);
          }
        });
      } catch {
        settings.current.fallback(url.href);
      }
    };
    const click = (event: MouseEvent) => {
      const link = switchLink(event, latest.current.route);
      if (!link) return;
      event.preventDefault();
      void follow(link.route, link.url, link.returning);
    };
    document.addEventListener("click", click);
    // Before a switch is asked for: the screen's chunk, and while signed in
    // its first private read (`readAhead` goes through a session guard and
    // never asks twice). The map's chunk is heavy: only when its link is
    // pressed or focused, not on a pointer passing or the menu opening.
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
    // A page that moves on by itself, as the account after sign-in.
    const stopNavigate = onNavigate((href) => {
      const url = new URL(href, location.href);
      const route = url.origin === location.origin ? screenRoute(url) : null;
      if (!route || !switches(route, url, latest.current.route)) return false;
      void follow(route, url, false);
      return true;
    });

    const stop = onTraversal(({ route, left, arrive }) => {
      const from = latest.current.route;
      if (!route || route === from) {
        arrive();
        return;
      }
      pending++;
      switched.current = true;
      recheckSession();
      const away = leave(from);
      if (left?.id) remembered.set(left.id, away);
      const arriveAt = (screen: Screen) => {
        try {
          // A screen mounted here subscribes in its effects; the arrival
          // waits for them, so a hook that starts from its own default (the
          // map's level) still hears the entry.
          flushSync(() => show(route, screen));
          flushSync(arrive);
          const back = remembered.get(currentEntryId() ?? "");
          // Without a record here, the browser restores the scroll itself.
          if (back) window.scrollTo(0, back.scroll);
          enter(route, back);
        } catch {
          location.reload();
        }
      };
      const screen = latest.current.screens[route];
      if (screen) arriveAt(screen);
      else
        settings.current.load(route).then(
          (screen) => {
            if (currentRoute() === route) arriveAt(screen);
          },
          () => location.reload(),
        );
    });
    return () => {
      document.removeEventListener("click", click);
      document.removeEventListener("pointerdown", pressed);
      document.removeEventListener("focusin", pressed);
      document.removeEventListener("pointerover", passed);
      document.removeEventListener(MENU_OPEN, opened);
      stopNavigate();
      stop();
    };
  }, [slots]);
  const content = ROUTES.map((route) => {
    const Screen = shown.screens[route];
    return Screen && (kept(route) || route === shown.route) ? (
      <ScreenSlot
        key={route}
        route={route}
        active={route === shown.route}
        slots={slots}
      >
        <ScreenBoundary onError={failed}>
          <Screen />
        </ScreenBoundary>
      </ScreenSlot>
    ) : null;
  });
  return import.meta.env.VITE_ACCOUNTS_ENABLED === "true" ? (
    <RecordsHost>{content}</RecordsHost>
  ) : (
    content
  );
}

/** Starts a records load beside the screen's own, before the first render. */
export function prepareRecords() {
  return import.meta.env.VITE_ACCOUNTS_ENABLED === "true" && signedIn()
    ? preloadRecords().catch(() => undefined)
    : undefined;
}

/**
 * Renders the document's own screen. All but the map draw in the module's
 * render block, as their HTML expects; `cardCount` names the map's count
 * when this document is another screen's.
 */
export function startScreens(
  element: HTMLElement,
  route: HistoryRoute,
  screen: Screen,
  cardCount = 0,
) {
  const meta = {
    ...(Object.fromEntries(
      ROUTES.map((other) => [other, screenMeta[other](cardCount)]),
    ) as Record<HistoryRoute, DocumentMeta>),
    [route]: readDocumentMeta(),
  };
  const app = <App initial={route} screens={{ [route]: screen }} meta={meta} />;
  if (route === "map") createRoot(element).render(app);
  else renderDocument(element, app);
}
