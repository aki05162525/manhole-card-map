import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  mapCardUrl,
  mergeCatalogHistoryState,
  readMapCardUrl,
} from "./catalog-url";

/** URL selection is independent of map readiness. Omit cardIds until data loads. */
export function useMapUrlState(cardIds?: ReadonlySet<string>) {
  const [url, setUrl] = useState(() => window.location.href);
  const owner = useRef<string | null>(null);
  const selection = useMemo(() => readMapCardUrl(url, cardIds), [url, cardIds]);
  useEffect(() => {
    const restore = () => setUrl(window.location.href);
    window.addEventListener("popstate", restore);
    // Catch navigation between render and effect registration.
    restore();
    return () => window.removeEventListener("popstate", restore);
  }, []);

  const selectCard = useCallback((card: string) => {
    if (readMapCardUrl(window.location.href).card === card) return;
    owner.current ??= crypto.randomUUID();
    history.pushState(
      {
        ...mergeCatalogHistoryState(history.state, { card }),
        mapCardNavigation: { owner: owner.current, card },
      },
      "",
      mapCardUrl(card),
    );
    setUrl(window.location.href);
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
    setUrl(window.location.href);
  }, []);

  return {
    cardId: selection.card,
    issues: selection.issues,
    selectCard,
    closeCard,
  };
}
