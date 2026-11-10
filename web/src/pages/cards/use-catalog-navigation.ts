import { useRecords } from "../../features/records/records-context";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CATALOG_PAGE_SIZE,
  catalogCards,
  paginateCards,
  type CardCatalog,
} from "../../domain/card-catalog";
import {
  catalogUrl,
  mergeCatalogHistoryState,
  readCatalogUrl,
  type CatalogUrlState,
} from "../../shared/url/catalog-url";

/** Owns only this mounted catalog's history entries and focus return targets. */
export function useCatalogNavigation(catalog: CardCatalog) {
  const records = /* @__PURE__ */ useRecords();
  const [href, setHref] = useState(() =>
    typeof window === "undefined" ? "/cards.html" : window.location.href,
  );
  const raw = useMemo(() => readCatalogUrl(href), [href]);
  const cardIds = useMemo(() => new Set(catalog.cardsById.keys()), [catalog]);
  const matchReceipt =
    import.meta.env.VITE_ACCOUNTS_ENABLED === "true"
      ? records.matches
      : undefined;
  const cards = useMemo(() => {
    const cards = catalogCards(catalog, { pref: raw.pref, q: raw.q });
    return matchReceipt ? cards.filter((card) => matchReceipt(card.id)) : cards;
  }, [catalog, raw.pref, raw.q, matchReceipt]);
  const state = useMemo(
    () =>
      readCatalogUrl(href, {
        cardIds,
        totalPages: Math.max(1, Math.ceil(cards.length / CATALOG_PAGE_SIZE)),
      }),
    [href, cardIds, cards.length],
  );
  const page = useMemo(
    () => paginateCards(cards, state.page),
    [cards, state.page],
  );
  const detailHeading = useRef<HTMLHeadingElement>(null);
  const resultsHeading = useRef<HTMLHeadingElement>(null);
  const returnRow = useRef<string | null>(null);
  const restoreFocus = useRef(false);
  const ownedEntries = useRef(new Set<string>());
  const sequence = useRef(0);
  useEffect(() => {
    const pop = () => setHref(window.location.href);
    window.addEventListener("popstate", pop);
    return () => window.removeEventListener("popstate", pop);
  }, []);
  useEffect(() => {
    if (state.card) detailHeading.current?.focus();
    else if (restoreFocus.current) {
      restoreFocus.current = false;
      const row = returnRow.current
        ? document.getElementById(`catalog-row-${returnRow.current}`)
        : null;
      (row ?? resultsHeading.current)?.focus();
    }
  }, [state.card]);
  const navigate = useCallback(
    (next: CatalogUrlState, replace = false, detail = false) => {
      const url = catalogUrl(next);
      const historyState = mergeCatalogHistoryState(window.history.state, {
        card: next.card,
      });
      // Only entries created by this mounted catalog may close with history.back().
      const token = detail ? `${Date.now()}-${++sequence.current}` : null;
      if (token) ownedEntries.current.add(token);
      const merged = { ...historyState, catalogDetailEntry: token };
      if (replace) window.history.replaceState(merged, "", url);
      else window.history.pushState(merged, "", url);
      setHref(window.location.href);
    },
    [],
  );
  function closeDetail() {
    restoreFocus.current = true;
    if (ownedEntries.current.has(window.history.state?.catalogDetailEntry))
      window.history.back();
    else navigate({ ...state, card: null }, true);
  }
  const openDetail = useCallback(
    (id: string) => {
      returnRow.current = id;
      navigate({ ...state, card: id }, false, true);
    },
    [navigate, state],
  );
  const changePage = useCallback(
    (page: number) => {
      navigate({ ...state, page, card: null });
      resultsHeading.current?.focus();
    },
    [navigate, state],
  );
  return {
    recordFiltered:
      import.meta.env.VITE_ACCOUNTS_ENABLED === "true" &&
      records.filter !== "all",
    state,
    cards,
    page,
    navigate,
    openDetail,
    closeDetail,
    changePage,
    detailHeading,
    resultsHeading,
  };
}
