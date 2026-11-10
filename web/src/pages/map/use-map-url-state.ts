import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

/** URL selection is independent of map readiness. Omit cardIds until data loads. */
export function useMapUrlState(cardIds?: ReadonlySet<string>) {
  const [snapshot, setSnapshot] = useState(() => ({
    url: window.location.href,
    search: readMapSearch(history.state),
  }));
  const { url, search } = snapshot;
  const currentSnapshot = useRef(snapshot);
  currentSnapshot.current = snapshot;
  const latest = useRef(search);
  const sync = () =>
    setSnapshot({
      url: window.location.href,
      search: readMapSearch(history.state),
    });
  const owner = useRef<string | null>(null);
  const pending = useRef<Partial<MapSearchSession> | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelWrite = useCallback(() => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
    pending.current = null;
  }, []);
  const flush = useCallback(() => {
    const patch = pending.current;
    cancelWrite();
    if (!patch) return;
    history.replaceState(
      withMapSearch(history.state, {
        ...readMapSearch(history.state),
        ...patch,
      }),
      "",
      window.location.href,
    );
  }, [cancelWrite]);
  const selection = useMemo(() => readMapCardUrl(url, cardIds), [url, cardIds]);
  useEffect(() => {
    const restore = (event?: PopStateEvent) => {
      // A sheet-only history entry leaves both the card URL and search untouched.
      if (
        event &&
        window.location.href === currentSnapshot.current.url &&
        JSON.stringify(readMapSearch(history.state)) ===
          JSON.stringify(currentSnapshot.current.search)
      )
        return;
      cancelWrite();
      let restored = readMapSearch(history.state);
      if (restored.phase === "map") {
        restored = {
          ...restored,
          query: latest.current.query,
          limit: latest.current.limit,
          scroll: latest.current.scroll,
          selected: latest.current.selected,
        };
        history.replaceState(
          withMapSearch(history.state, restored),
          "",
          window.location.href,
        );
      } else if (restored.phase === "search") {
        restored = { ...restored, restore: true };
        history.replaceState(
          withMapSearch(history.state, restored),
          "",
          window.location.href,
        );
      }
      latest.current = restored;
      sync();
    };
    window.addEventListener("popstate", restore);
    // Catch navigation between render and effect registration.
    restore();
    return () => {
      window.removeEventListener("popstate", restore);
      cancelWrite();
    };
  }, [cancelWrite]);

  const selectCard = useCallback(
    (card: string) => {
      flush();
      if (
        readMapCardUrl(window.location.href).card === card &&
        readMapSearch(history.state).phase !== "search"
      )
        return;
      owner.current ??= crypto.randomUUID();
      history.pushState(
        {
          ...mergeCatalogHistoryState(history.state, { card }),
          mapCardNavigation: { owner: owner.current, card },
          mapSearch: {
            ...readMapSearch(history.state),
            phase:
              readMapSearch(history.state).phase === "search"
                ? "detail"
                : "map",
          },
        },
        "",
        import.meta.env.VITE_ACCOUNTS_ENABLED === "true" &&
          new URLSearchParams(location.search).has("friend")
          ? `${mapCardUrl(card)}&${new URLSearchParams({ friend: new URLSearchParams(location.search).get("friend")! })}`
          : mapCardUrl(card),
      );
      sync();
    },
    [flush],
  );

  const closeCard = useCallback(() => {
    flush();
    const current = readMapCardUrl(window.location.href);
    const navigation = history.state?.mapCardNavigation;
    if (
      owner.current &&
      navigation?.owner === owner.current &&
      navigation.card === current.card
    ) {
      history.back();
      return;
    }
    const next = new URL(window.location.href);
    next.searchParams.delete("card");
    history.replaceState(
      mergeCatalogHistoryState(history.state, { card: null }),
      "",
      `${next.pathname}${next.search}${next.hash}`,
    );
    sync();
  }, [flush]);

  const updateSearch = (patch: Partial<MapSearchSession>) => {
    pending.current = { ...pending.current, ...patch };
    const next = { ...readMapSearch(history.state), ...pending.current };
    latest.current = next;
    setSnapshot({ url: window.location.href, search: next });
    timer.current ??= setTimeout(flush, HISTORY_WRITE_INTERVAL);
  };
  const openSearch = () => {
    flush();
    const current = readMapSearch(history.state);
    if (current.phase === "detail" && current.owner === owner.current) {
      history.back();
      return;
    }
    owner.current ??= crypto.randomUUID();
    history.pushState(
      withMapSearch(history.state, {
        ...current,
        phase: "search",
        owner: owner.current,
        restore: false,
      }),
      "",
      window.location.href,
    );
    sync();
  };
  const closeSearch = () => {
    flush();
    if (search.owner && search.owner === owner.current) history.back();
    else updateSearch({ phase: "map" });
  };
  const dismissCard = () => {
    flush();
    const next = new URL(window.location.href);
    next.searchParams.delete("card");
    history.replaceState(
      withMapSearch(mergeCatalogHistoryState(history.state, { card: null }), {
        ...readMapSearch(history.state),
        phase: "map",
      }),
      "",
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
