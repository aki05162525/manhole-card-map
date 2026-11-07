import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  mapCardUrl,
  mergeCatalogHistoryState,
  readMapCardUrl,
} from "./catalog-url";

import {
  readMapSearch,
  withMapSearch,
  type MapSearchSession,
} from "./map-search-state";

/** URL selection is independent of map readiness. Omit cardIds until data loads. */
export function useMapUrlState(cardIds?: ReadonlySet<string>) {
  const [snapshot, setSnapshot] = useState(() => ({
    url: window.location.href,
    search: readMapSearch(history.state),
  }));
  const { url, search } = snapshot;
  const latest = useRef(search);
  const sync = () =>
    setSnapshot({
      url: window.location.href,
      search: readMapSearch(history.state),
    });
  const owner = useRef<string | null>(null);
  const selection = useMemo(() => readMapCardUrl(url, cardIds), [url, cardIds]);
  useEffect(() => {
    const restore = () => {
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
    return () => window.removeEventListener("popstate", restore);
  }, []);

  const selectCard = useCallback((card: string) => {
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
            readMapSearch(history.state).phase === "search" ? "detail" : "map",
        },
      },
      "",
      mapCardUrl(card),
    );
    sync();
  }, []);

  const closeCard = useCallback(() => {
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
  }, []);

  const updateSearch = (patch: Partial<MapSearchSession>) => {
    const next = { ...readMapSearch(history.state), ...patch };
    latest.current = next;
    history.replaceState(
      withMapSearch(history.state, next),
      "",
      window.location.href,
    );
    sync();
  };
  const openSearch = () => {
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
    if (search.owner && search.owner === owner.current) history.back();
    else updateSearch({ phase: "map" });
  };
  const dismissCard = () => {
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
