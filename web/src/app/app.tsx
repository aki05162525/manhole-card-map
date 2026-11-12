import {
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
  onTraversal,
  switchScreen,
  type HistoryRoute,
} from "../shared/browser/app-history";
import { renderDocument } from "../shared/browser/render-document";
import { ScreenActivity } from "../shared/browser/screen-activity";
import { recheckSession, signedIn } from "../shared/browser/signed-in";
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
 * The map and the catalog share one document once either is opened: links
 * and back/forward between them switch screens here, and the map stays alive
 * behind the catalog. Each still starts from its own HTML (`main.ts`,
 * `cards-main.tsx`); every other page is a document navigation.
 */
type Screen = ComponentType;
type Screens = Partial<Record<HistoryRoute, Screen>>;
const ROUTES: HistoryRoute[] = ["map", "catalog"];

const loadScreen = async (route: HistoryRoute): Promise<Screen> =>
  (route === "map"
    ? await import("./map-screen")
    : await import("./catalog-screen")
  ).default;

/** A friend's map stays a document of its own (Issue #260). */
function screenRoute(url: URL) {
  const route = historyRoute(url.pathname);
  return route === "map" &&
    import.meta.env.VITE_ACCOUNTS_ENABLED === "true" &&
    url.searchParams.has("friend")
    ? null
    : route;
}

/** A plain click on a link to the other screen; anything else is the browser's. */
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
  const link =
    event.target instanceof Element ? event.target.closest("a[href]") : null;
  if (
    !(link instanceof HTMLAnchorElement) ||
    (link.target && link.target !== "_self") ||
    link.hasAttribute("download")
  )
    return null;
  const url = new URL(link.href);
  const route = url.origin === location.origin ? screenRoute(url) : null;
  // The site's own navigation goes back to a screen; a link in the content
  // means the place it names.
  const returning = Boolean(link.closest("header, nav"));
  return route && route !== shown ? { route, url, returning } : null;
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
 * the map with a card keeps its level and selects the card; anything else
 * starts fresh at the link's URL.
 */
function landing(route: HistoryRoute, url: URL, returning: boolean) {
  const last = latestEntry(route);
  if (last && returning && !url.search && !url.hash)
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
  useEffect(() => {
    // Scroll and focus of entries left for the other screen, by entry id.
    const kept = new Map<string, Kept>();
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
      const target = landing(route, url, returning);
      // Another tab may have changed the user since this page was shown.
      recheckSession();
      const left = leave(from);
      transition(() => {
        if (token !== pending || currentRoute() !== from) return;
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
        if (moved.id) kept.set(moved.id, left);
        window.scrollTo(0, (target.left && kept.get(target.left)?.scroll) || 0);
        enter(route, undefined);
      });
    };
    const click = (event: MouseEvent) => {
      const link = switchLink(event, latest.current.route);
      if (!link) return;
      event.preventDefault();
      void follow(link.route, link.url, link.returning);
    };
    document.addEventListener("click", click);

    const stop = onTraversal(({ route, left, arrive }) => {
      const from = latest.current.route;
      if (!route || route === from) {
        arrive();
        return;
      }
      pending++;
      recheckSession();
      const away = leave(from);
      if (left?.id) kept.set(left.id, away);
      const arriveAt = (screen: Screen) => {
        flushSync(() => {
          show(route, screen);
          arrive();
        });
        const back = kept.get(currentEntryId() ?? "");
        // Without a record here, the browser restores the scroll itself.
        if (back) window.scrollTo(0, back.scroll);
        enter(route, back);
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
      stop();
    };
  }, [slots]);
  const content = ROUTES.map((route) => {
    const Screen = shown.screens[route];
    return Screen ? (
      <ScreenSlot
        key={route}
        route={route}
        active={route === shown.route}
        slots={slots}
      >
        <Screen />
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
 * Renders the document's own screen. The catalog draws in the module's
 * render block, as its HTML expects; `cardCount` names the map's count when
 * this document is the catalog's.
 */
export function startScreens(
  element: HTMLElement,
  route: HistoryRoute,
  screen: Screen,
  cardCount = 0,
) {
  const meta = {
    map: screenMeta.map(cardCount),
    catalog: screenMeta.catalog(cardCount),
    [route]: readDocumentMeta(),
  };
  const app = <App initial={route} screens={{ [route]: screen }} meta={meta} />;
  if (route === "catalog") renderDocument(element, app);
  else createRoot(element).render(app);
}
