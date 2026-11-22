import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { routeHistory } from "../../shared/browser/app-history";
import {
  mapCardUrl,
  mergeCatalogHistoryState,
  readMapCardUrl,
} from "../../shared/url/catalog-url";

import {
  historyFields,
  readMapSearch,
  restoreMapSearch,
  withMapSearch,
  type MapSearchSession,
} from "./map-search-state";

// Safari rejects more than 100 replaceState calls per 30 seconds.
const HISTORY_WRITE_INTERVAL = 500;
const entries = routeHistory("map");
/**
 * The detail this page opened at the current entry, if any. Another tab's
 * page leaves a different owner; a malformed one counts as none.
 */
function cardNavigation(state: unknown) {
  const { owner, card } = historyFields(historyFields(state).mapCardNavigation);
  return typeof owner === "string" && typeof card === "string"
    ? { owner, card }
    : null;
}

/**
 * URL selection is independent of map readiness. Pass `cardIds` once the
 * card's details are known; `requestedCard` is the card the URL names,
 * whether or not there is one.
 */
export function useMapUrlState(cardIds?: ReadonlySet<string>) {
  const [snapshot, showSnapshot] = useState(() => ({
    url: window.location.href,
    search: readMapSearch(entries.state()),
  }));
  const { url, search } = snapshot;
  // What a later arrival is compared with: written as the state is set,
  // ahead of the render that shows it.
  const currentSnapshot = useRef(snapshot);
  const setSnapshot = useCallback((next: typeof snapshot) => {
    currentSnapshot.current = next;
    showSnapshot(next);
  }, []);
  const latest = useRef(search);
  // While another screen's entry is current, the shown state stays as it is.
  const sync = useCallback(() => {
    if (entries.owns())
      setSnapshot({
        url: window.location.href,
        search: readMapSearch(entries.state()),
      });
  }, [setSnapshot]);
  const owner = useRef<string | null>(null);
  const [write] = useState(() =>
    entries.deferred(
      HISTORY_WRITE_INTERVAL,
      (state, patch: Partial<MapSearchSession>) =>
        withMapSearch(state, { ...readMapSearch(state), ...patch }),
    ),
  );
  const selection = useMemo(() => readMapCardUrl(url, cardIds), [url, cardIds]);
  const requestedCard = useMemo(() => readMapCardUrl(url).card, [url]);
  useEffect(() => {
    const restore = (traversed: boolean) => {
      if (!entries.owns()) return;
      const arrived = {
        url: window.location.href,
        search: readMapSearch(entries.state()),
      };
      const next = restoreMapSearch({
        traversed,
        arrived,
        shown: currentSnapshot.current,
        latest: latest.current,
      });
      if (!next) return;
      write.cancel();
      if (next.write)
        entries.replace(withMapSearch(entries.state(), next.search));
      latest.current = next.search;
      setSnapshot({ url: arrived.url, search: next.search });
    };
    const unsubscribe = entries.subscribe(() => restore(true));
    // Catch navigation between render and effect registration.
    restore(false);
    return () => {
      unsubscribe();
      write.cancel();
    };
  }, [write, setSnapshot]);

  const selectCard = useCallback(
    (card: string) => {
      write.flush();
      const state = entries.state();
      const current = readMapSearch(state);
      if (
        readMapCardUrl(window.location.href).card === card &&
        current.phase !== "search"
      )
        return;
      owner.current ??= crypto.randomUUID();
      // Switching from a detail this page opened replaces that entry, so one
      // close (or back) returns to the map instead of the previous pin.
      const navigation = cardNavigation(state);
      const switching =
        current.phase !== "search" &&
        navigation?.owner === owner.current &&
        navigation.card === readMapCardUrl(window.location.href).card;
      entries[switching ? "replace" : "push"](
        {
          ...mergeCatalogHistoryState(state, { card }),
          mapCardNavigation: { owner: owner.current, card },
          mapSearch: {
            ...current,
            phase: switching
              ? current.phase
              : current.phase === "search"
                ? "detail"
                : "map",
          },
        },
        import.meta.env.VITE_ACCOUNTS_ENABLED === "true" &&
          new URLSearchParams(location.search).has("friend")
          ? `${mapCardUrl(card)}&${new URLSearchParams({ friend: new URLSearchParams(location.search).get("friend")! })}`
          : mapCardUrl(card),
      );
      sync();
    },
    [write, sync],
  );

  const closeCard = useCallback(() => {
    write.flush();
    const current = readMapCardUrl(window.location.href);
    const navigation = cardNavigation(entries.state());
    if (
      owner.current &&
      navigation?.owner === owner.current &&
      navigation.card === current.card &&
      entries.back()
    )
      return;
    const next = new URL(window.location.href);
    next.searchParams.delete("card");
    next.searchParams.delete("step");
    entries.replace(
      mergeCatalogHistoryState(entries.state(), { card: null }),
      `${next.pathname}${next.search}${next.hash}`,
    );
    sync();
  }, [write, sync]);

  const updateSearch = (patch: Partial<MapSearchSession>) => {
    if (!entries.owns()) return;
    write.set((waiting) => ({ ...waiting, ...patch }));
    const next = { ...readMapSearch(entries.state()), ...write.pending };
    latest.current = next;
    setSnapshot({ url: window.location.href, search: next });
  };
  const openSearch = () => {
    write.flush();
    const current = readMapSearch(entries.state());
    if (
      current.phase === "detail" &&
      current.owner === owner.current &&
      entries.back()
    )
      return;
    owner.current ??= crypto.randomUUID();
    entries.push(
      withMapSearch(entries.state(), {
        ...current,
        phase: "search",
        owner: owner.current,
        restore: false,
      }),
    );
    sync();
  };
  const closeSearch = () => {
    write.flush();
    if (search.owner && search.owner === owner.current && entries.back())
      return;
    updateSearch({ phase: "map" });
  };
  const dismissCard = () => {
    write.flush();
    const next = new URL(window.location.href);
    next.searchParams.delete("card");
    next.searchParams.delete("step");
    entries.replace(
      withMapSearch(mergeCatalogHistoryState(entries.state(), { card: null }), {
        ...readMapSearch(entries.state()),
        phase: "map",
      }),
      `${next.pathname}${next.search}${next.hash}`,
    );
    sync();
  };
  return {
    search,
    updateSearch,
    openSearch,
    closeSearch,
    dismissCard,
    cardId: selection.card,
    requestedCard,
    urlStep: selection.step,
    issues: selection.issues,
    selectCard,
    closeCard,
  };
}
