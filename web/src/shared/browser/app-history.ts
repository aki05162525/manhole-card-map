/**
 * The only place that writes the History API or listens to popstate.
 * Each entry belongs to the screen its path names; a screen reads, writes and
 * hears only its own entries.
 */
export type HistoryRoute = "map" | "catalog" | "friends" | "account" | "about";
type HistoryState = Record<string, unknown>;
/** An entry as it was when it was last current. */
export type HistoryEntry = {
  route: HistoryRoute;
  id: string | null;
  url: string;
  state: unknown;
};

/** Local servers answer the `.html` paths without redirecting. */
export function historyRoute(pathname: string): HistoryRoute | null {
  if (/^\/(index\.html)?$/.test(pathname)) return "map";
  if (/^\/cards(\.html)?$/.test(pathname)) return "catalog";
  if (/^\/friends(\.html)?$/.test(pathname)) return "friends";
  if (/^\/account(\.html)?$/.test(pathname)) return "account";
  if (/^\/about(\.html)?$/.test(pathname)) return "about";
  return null;
}

const listeners = new Map<HistoryRoute, Set<() => void>>();
const writes = new Set<{ flush(): void }>();
// Tells apart two visits to entries that carry no id.
let visit = 0;
let listening = false;
// The entry current after the last write or arrival, and each screen's last.
let current: HistoryEntry | null = null;
const latest = new Map<HistoryRoute, HistoryEntry>();
let traversal: ((arrival: Traversal) => void) | null = null;

export function currentRoute() {
  return historyRoute(window.location.pathname);
}
/**
 * `from` is the screen whose entry lies directly behind this one. Entries
 * written before the mark existed, or carrying another screen's, have none.
 */
type EntryMark = { route: HistoryRoute; id: string; from: HistoryRoute | null };
function currentMark(): EntryMark | null {
  const mark = (window.history.state as { appEntry?: EntryMark } | null)
    ?.appEntry;
  return mark && typeof mark.id === "string" && mark.route === currentRoute()
    ? mark
    : null;
}
function record() {
  const route = currentRoute();
  current = route && {
    route,
    id: currentMark()?.id ?? null,
    url: window.location.href,
    state: window.history.state,
  };
  if (current) latest.set(current.route, current);
}
function arrive(route: HistoryRoute) {
  if (currentRoute() !== route) return;
  const heard = listeners.get(route);
  if (!heard) return;
  // A listener removed by an earlier one is skipped, as the DOM does.
  for (const listener of Array.from(heard)) if (heard.has(listener)) listener();
}
function listen() {
  if (listening) return;
  listening = true;
  record();
  window.addEventListener("popstate", () => {
    visit++;
    const left = current;
    record();
    const route = currentRoute();
    const heard = () => {
      if (route) arrive(route);
    };
    if (traversal) traversal({ route, left, arrive: heard });
    else heard();
  });
}

/**
 * A back or forward move. `left` is the entry that was current; `arrive`
 * tells the screen whose entry this is, and the handler decides when.
 */
export type Traversal = {
  route: HistoryRoute | null;
  left: HistoryEntry | null;
  arrive(): void;
};
/** For the layer that shows the screens: it hears every popstate first. */
export function onTraversal(handler: (arrival: Traversal) => void) {
  listen();
  traversal = handler;
  return () => {
    if (traversal === handler) traversal = null;
  };
}
/** The screen's entry as it was when that screen was last current. */
export function latestEntry(route: HistoryRoute): HistoryEntry | null {
  listen();
  if (currentRoute() === route) record();
  return latest.get(route) ?? null;
}
/** The current entry's id, once a write or a switch has given it one. */
export function currentEntryId() {
  return currentMark()?.id ?? null;
}

const withoutMark = (state: unknown) => {
  const { appEntry: _, ...rest } = (
    state && typeof state === "object" ? state : {}
  ) as HistoryState;
  return rest;
};
/**
 * Leaves the screen `from` for a new entry of the screen `to` at `url`.
 * Delayed writes are committed to the entry left, which keeps a mark of its
 * own. The new entry is `to`'s, with `from` behind it, so `back()` on it
 * refuses. Its listeners hear the arrival unless the entry is the one that
 * screen showed last, unchanged. `from` and `to` are the same screen only
 * for another view of it at another URL (the map of a friend, or one's own):
 * its listeners hear it as an arrival. Returns the entry left, or null when
 * refused: unless `from`'s entry is current and `url` names `to`.
 */
export function switchScreen({
  from,
  to,
  url,
  state,
}: {
  from: HistoryRoute;
  to: HistoryRoute;
  url: string;
  state: unknown;
}) {
  const next = new URL(url, window.location.href);
  if (
    (from === to && next.href === window.location.href) ||
    currentRoute() !== from ||
    next.origin !== window.location.origin ||
    historyRoute(next.pathname) !== to
  )
    return null;
  listen();
  flushHistoryWrites();
  if (!currentMark())
    window.history.replaceState(
      {
        ...withoutMark(window.history.state),
        appEntry: { route: from, id: crypto.randomUUID(), from: null },
      },
      "",
    );
  record();
  const left = current;
  const shown = latest.get(to);
  const unchanged =
    from !== to &&
    shown?.url === next.href &&
    JSON.stringify(withoutMark(shown.state)) ===
      JSON.stringify(withoutMark(state));
  visit++;
  const appEntry: EntryMark = { route: to, id: crypto.randomUUID(), from };
  window.history.pushState({ ...withoutMark(state), appEntry }, "", next.href);
  record();
  if (!unchanged) arrive(to);
  return left;
}

let navigation: ((href: string) => boolean) | null = null;
/**
 * Goes to `href` as a link would: by a switch when the layer that shows the
 * screens takes it, else as a document. For a page that moves on by itself
 * (the account page after sign-in).
 */
export function navigate(href: string) {
  if (!navigation?.(href)) location.assign(href);
}
/** For that layer: `handler` returns whether it took the move. */
export function onNavigate(handler: (href: string) => boolean) {
  navigation = handler;
  return () => {
    if (navigation === handler) navigation = null;
  };
}

/**
 * Commit every delayed write now: before a screen is left, and before a push
 * that does not go through the hook holding the write.
 */
export function flushHistoryWrites() {
  for (const write of Array.from(writes)) write.flush();
}

const routes = new Map<HistoryRoute, ReturnType<typeof createRouteHistory>>();
export function routeHistory(route: HistoryRoute) {
  let history = routes.get(route);
  if (!history) routes.set(route, (history = createRouteHistory(route)));
  return history;
}

function createRouteHistory(route: HistoryRoute) {
  const owns = () => currentRoute() === route;
  const write = (
    method: "pushState" | "replaceState",
    state: HistoryState,
    url?: string,
  ) => {
    if (!owns()) return false;
    const appEntry: EntryMark =
      method === "pushState"
        ? { route, id: crypto.randomUUID(), from: route }
        : (currentMark() ?? { route, id: crypto.randomUUID(), from: null });
    if (method === "pushState") visit++;
    window.history[method]({ ...state, appEntry }, "", url);
    record();
    return true;
  };
  return {
    /** Whether the current entry is this screen's. */
    owns,
    /** The current entry's state, or null while another screen's is current. */
    state: (): unknown => (owns() ? window.history.state : null),
    /** Both writes are refused while another screen's entry is current. */
    push: (state: HistoryState, url?: string) => write("pushState", state, url),
    replace: (state: HistoryState, url?: string) =>
      write("replaceState", state, url),
    /**
     * Goes back only when that lands on this screen's entry. On false the
     * caller closes its own state instead.
     */
    back() {
      if (currentMark()?.from !== route) return false;
      window.history.back();
      return true;
    },
    /**
     * Hears arrivals at this screen's entries only: popstate, and a switch
     * from another screen that changes what this screen shows.
     */
    subscribe(listener: () => void) {
      listen();
      let current = listeners.get(route);
      if (!current) listeners.set(route, (current = new Set()));
      current.add(listener);
      return () => {
        current.delete(listener);
      };
    },
    /**
     * A replace of the current entry, delayed to stay within the browser's
     * write limit. It is dropped unless that same entry is still current.
     */
    deferred<T>(
      delay: number,
      commit: (state: unknown, value: T) => HistoryState,
    ) {
      let pending: { value: T; visit: number; id: string | null } | null = null;
      let timer: ReturnType<typeof setTimeout> | null = null;
      // Giving the entry its first id does not make it another entry.
      const scheduledHere = () =>
        pending !== null &&
        owns() &&
        pending.visit === visit &&
        (pending.id === null || pending.id === currentMark()?.id);
      const cancel = () => {
        if (timer !== null) clearTimeout(timer);
        timer = null;
        pending = null;
        writes.delete(deferred);
      };
      const deferred = {
        get pending() {
          return pending?.value ?? null;
        },
        /** `next` receives what is still waiting for this same entry. */
        set(next: (waiting: T | null) => T) {
          if (!owns()) return;
          listen();
          if (pending && !scheduledHere()) cancel();
          pending = {
            value: next(pending?.value ?? null),
            visit,
            id: pending?.id ?? currentMark()?.id ?? null,
          };
          writes.add(deferred);
          timer ??= setTimeout(deferred.flush, delay);
        },
        flush() {
          const value = scheduledHere() ? pending!.value : null;
          cancel();
          if (value !== null)
            write("replaceState", commit(window.history.state, value));
        },
        cancel,
      };
      return deferred;
    },
  };
}
