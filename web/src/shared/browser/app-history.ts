/**
 * The only place that writes the History API or listens to popstate.
 * Each entry belongs to the screen its path names; a screen reads, writes and
 * hears only its own entries.
 */
export type HistoryRoute = "map" | "catalog";
type HistoryState = Record<string, unknown>;

/** Local servers answer the `.html` paths without redirecting. */
function historyRoute(pathname: string): HistoryRoute | null {
  if (/^\/(index\.html)?$/.test(pathname)) return "map";
  if (/^\/cards(\.html)?$/.test(pathname)) return "catalog";
  return null;
}

const listeners = new Map<HistoryRoute, Set<() => void>>();
const writes = new Set<{ flush(): void }>();
// Tells apart two visits to entries that carry no id.
let visit = 0;
let listening = false;

function currentRoute() {
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
function listen() {
  if (listening) return;
  listening = true;
  window.addEventListener("popstate", () => {
    visit++;
    const route = currentRoute();
    const current = route && listeners.get(route);
    if (!current) return;
    // A listener removed by an earlier one is skipped, as the DOM does.
    for (const listener of Array.from(current))
      if (current.has(listener)) listener();
  });
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
    /** Hears popstate only when it arrives at one of this screen's entries. */
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
