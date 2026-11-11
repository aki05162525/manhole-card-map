import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { routeHistory } from "../../shared/browser/app-history";
import {
  mapCardUrl,
  mergeCatalogHistoryState,
  readMapCardUrl,
} from "../../shared/url/catalog-url";

import {
  readMapSearch,
  withMapSearch,
  type MapSearchSession,
} from "./map-search-state";

// Safari rejects more than 100 replaceState calls per 30 seconds.
const HISTORY_WRITE_INTERVAL = 500;
const entries = routeHistory("map");

/** URL selection is independent of map readiness. Omit cardIds until data loads. */
export function useMapUrlState(cardIds?: ReadonlySet<string>) {
  const [snapshot, setSnapshot] = useState(() => ({
    url: window.location.href,
    search: readMapSearch(entries.state()),
  }));
  const { url, search } = snapshot;
  const currentSnapshot = useRef(snapshot);
  currentSnapshot.current = snapshot;
  const latest = useRef(search);
  // While another screen's entry is current, the shown state stays as it is.
  const sync = () => {
    if (entries.owns())
      setSnapshot({
        url: window.location.href,
        search: readMapSearch(entries.state()),
      });
  };
  const owner = useRef<string | null>(null);
  const [write] = useState(() =>
    entries.deferred(
      HISTORY_WRITE_INTERVAL,
      (state, patch: Partial<MapSearchSession>) =>
        withMapSearch(state, { ...readMapSearch(state), ...patch }),
    ),
  );
  const selection = useMemo(() => readMapCardUrl(url, cardIds), [url, cardIds]);
  useEffect(() => {
    const restore = (traversed: boolean) => {
      if (!entries.owns()) return;
      // A sheet-only history entry leaves both the card URL and search untouched.
      if (
        traversed &&
        window.location.href === currentSnapshot.current.url &&
        JSON.stringify(readMapSearch(entries.state())) ===
          JSON.stringify(currentSnapshot.current.search)
      )
        return;
      write.cancel();
      let restored = readMapSearch(entries.state());
      if (restored.phase === "map") {
        restored = {
          ...restored,
          query: latest.current.query,
          limit: latest.current.limit,
          scroll: latest.current.scroll,
          selected: latest.current.selected,
        };
        entries.replace(withMapSearch(entries.state(), restored));
      } else if (restored.phase === "search") {
        restored = { ...restored, restore: true };
        entries.replace(withMapSearch(entries.state(), restored));
      }
      latest.current = restored;
      sync();
    };
    const unsubscribe = entries.subscribe(() => restore(true));
    // Catch navigation between render and effect registration.
    restore(false);
    return () => {
      unsubscribe();
      write.cancel();
    };
  }, [write]);

  const selectCard = useCallback(
    (card: string) => {
      write.flush();
      const state = entries.state() as {
        mapCardNavigation?: { owner?: string; card?: string } | null;
      } | null;
      const current = readMapSearch(state);
      if (
        readMapCardUrl(window.location.href).card === card &&
        current.phase !== "search"
      )
        return;
      owner.current ??= crypto.randomUUID();
      // Switching from a detail this page opened replaces that entry, so one
      // close (or back) returns to the map instead of the previous pin.
      const navigation = state?.mapCardNavigation;
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
    [write],
  );

  const closeCard = useCallback(() => {
    write.flush();
    const current = readMapCardUrl(window.location.href);
    const navigation = (
      entries.state() as {
        mapCardNavigation?: { owner?: string; card?: string } | null;
      } | null
    )?.mapCardNavigation;
    if (
      owner.current &&
      navigation?.owner === owner.current &&
      navigation.card === current.card &&
      entries.back()
    )
      return;
    const next = new URL(window.location.href);
    next.searchParams.delete("card");
    entries.replace(
      mergeCatalogHistoryState(entries.state(), { card: null }),
      `${next.pathname}${next.search}${next.hash}`,
    );
    sync();
  }, [write]);

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
    issues: selection.issues,
    selectCard,
    closeCard,
  };
}
