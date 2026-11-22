import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { preloadRecords, RecordsHost } from "../features/records/records-entry";
import {
  currentEntryId,
  currentRoute,
  onNavigate,
  onTraversal,
  switchScreen,
  type HistoryRoute,
} from "../shared/browser/app-history";
import { renderDocument } from "../shared/browser/render-document";
import { recheckSession, signedIn } from "../session/signed-in";
import {
  applyDocumentMeta,
  readDocumentMeta,
  screenMeta,
  type DocumentMeta,
} from "./document-meta";
import { noSwitch, settleSwitch, startSwitch } from "./screen-switch";
import "./app.css";
import { usePrepareScreens } from "./prepare-screens";
import { leaveScreen, enterScreen, type Kept } from "./screen-focus";
import { landing, switchLink, switchRoute } from "./screen-links";
import { ScreenSlot, ScreenBoundary } from "./screen-slot";
import { kept, loadScreen, type Screen, type Screens } from "./screens";

/**
 * The map, catalog, friends, account and about screens share one document once
 * any of them is opened: links and back/forward between them switch screens
 * here, and the map stays alive behind the others. Each still starts from
 * its own HTML (`main.ts`, `cards-main.tsx`, `friends-main.tsx`,
 * `account-main.tsx`, `about-main.tsx`); every other page is a document
 * navigation.
 */
const ROUTES: HistoryRoute[] = [
  "map",
  "catalog",
  "friends",
  "account",
  "about",
];
const assignLocation = (href: string) => location.assign(href);
const reloadLocation = () => location.reload();

export function App({
  initial,
  screens: given,
  meta,
  load = loadScreen,
  fallback = assignLocation,
  reload = reloadLocation,
}: {
  initial: HistoryRoute;
  screens: Screens;
  meta: Record<HistoryRoute, DocumentMeta>;
  load?: (route: HistoryRoute) => Promise<Screen>;
  /** Where a link goes when its screen cannot be loaded. */
  fallback?: (href: string) => void;
  /** What a back or forward does when its screen cannot be shown. */
  reload?: () => void;
}) {
  const [shown, setShown] = useState({ route: initial, screens: given });
  // What the listeners below go by: written as a switch is made, ahead of
  // the render that shows it.
  const latest = useRef(shown);
  const [slots] = useState(() => new Map<HistoryRoute, HTMLElement>());
  const settings = useRef({ meta, load, fallback, reload });
  useLayoutEffect(() => {
    settings.current = { meta, load, fallback, reload };
  }, [meta, load, fallback, reload]);
  // Once a switch has happened, the URL may name a screen this document did
  // not start with; one that fails then loads as its own document. Before,
  // a reload would only fail the same way.
  const switched = useRef(false);
  // A screen that throws is caught before the layout effect above runs:
  // the boundary follows the fallback of that render, not the ref's.
  const failed = () => {
    if (switched.current) fallback(location.href);
  };
  usePrepareScreens(latest, settings);
  useEffect(() => {
    // Scroll and focus of entries left for the other screen, by entry id.
    const remembered = new Map<string, Kept>();
    let awaited = noSwitch;
    const begin = (inPlace?: boolean) => {
      const started = startSwitch(awaited, { inPlace });
      awaited = started.state;
      return started;
    };
    const slot = (route: HistoryRoute) => slots.get(route) ?? null;
    const leave = (route: HistoryRoute) => leaveScreen(slot(route));
    const enter = (
      route: HistoryRoute,
      back: Kept | undefined,
      fragment = false,
    ) => {
      applyDocumentMeta(settings.current.meta[route]);
      const element = slot(route);
      if (element) enterScreen(element, back, fragment);
    };
    const show = (route: HistoryRoute, screen: Screen) => {
      latest.current = {
        route,
        screens: { ...latest.current.screens, [route]: screen },
      };
      setShown(latest.current);
    };

    const follow = async (
      route: HistoryRoute,
      url: URL,
      returning: boolean,
    ) => {
      const from = latest.current.route;
      const { id, action: first } = begin(currentRoute() === from);
      if (first === "fallback") {
        settings.current.fallback(url.href);
        return;
      }
      let screen = latest.current.screens[route];
      if (!screen)
        screen = await settings.current.load(route).catch(() => undefined);
      const action = settleSwitch(awaited, {
        id,
        loaded: Boolean(screen),
        inPlace: latest.current.route === from && currentRoute() === from,
      });
      if (action === "drop") return;
      if (action === "fallback" || !screen) {
        settings.current.fallback(url.href);
        return;
      }
      // Whatever fails before the screen is shown, the link still goes.
      try {
        const target = landing(route, url, returning);
        // Another tab may have changed the user since this page was shown.
        recheckSession();
        const left = leave(from);
        if (currentRoute() !== from) return;
        switched.current = true;
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
        enter(route, undefined, true);
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
    // A page that moves on by itself, as the account after sign-in.
    const stopNavigate = onNavigate((href) => {
      const url = new URL(href, location.href);
      const route = switchRoute(url, latest.current.route);
      if (!route) return false;
      void follow(route, url, false);
      return true;
    });

    const stop = onTraversal(({ route, left, arrive }) => {
      const from = latest.current.route;
      // Even within the screen shown, a back or forward is the user's latest
      // choice: a switch still loading no longer goes on.
      const { id } = begin();
      if (!route || route === from) {
        arrive();
        return;
      }
      switched.current = true;
      recheckSession();
      const away = leave(from);
      if (left?.id) remembered.set(left.id, away);
      const arriveAt = (screen: Screen) => {
        try {
          // A screen mounted here subscribes in its effects; the arrival
          // waits for them, so a hook that starts from its own default still
          // hears the entry.
          flushSync(() => show(route, screen));
          flushSync(arrive);
          const back = remembered.get(currentEntryId() ?? "");
          // Without a record here, the browser restores the scroll itself.
          if (back) window.scrollTo(0, back.scroll);
          enter(route, back);
        } catch {
          settings.current.reload();
        }
      };
      const screen = latest.current.screens[route];
      if (screen) arriveAt(screen);
      else
        void settings.current
          .load(route)
          .catch(() => undefined)
          .then((screen) => {
            const action = settleSwitch(awaited, {
              id,
              loaded: Boolean(screen),
              inPlace: currentRoute() === route,
            });
            if (action === "show" && screen) arriveAt(screen);
            else if (action !== "drop") settings.current.reload();
          });
    });
    return () => {
      document.removeEventListener("click", click);
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
  const meta: Record<HistoryRoute, DocumentMeta> = {
    map: screenMeta.map(cardCount),
    catalog: screenMeta.catalog(cardCount),
    friends: screenMeta.friends(cardCount),
    account: screenMeta.account(cardCount),
    about: screenMeta.about(cardCount),
    [route]: readDocumentMeta(),
  };
  const app = <App initial={route} screens={{ [route]: screen }} meta={meta} />;
  if (route === "map") createRoot(element).render(app);
  else renderDocument(element, app);
}
