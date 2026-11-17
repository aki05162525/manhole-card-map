import { useRecords } from "../../features/records/records-context";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CATALOG_PAGE_SIZE,
  catalogCards,
  paginateCards,
  type CardCatalog,
} from "../../domain/card-catalog";
import {
  cardPageUrl,
  catalogUrl,
  mergeCatalogHistoryState,
  readCatalogUrl,
  type CatalogUrlState,
} from "../../shared/url/catalog-url";
import {
  replaceDocument,
  routeHistory,
} from "../../shared/browser/app-history";
import { useScreenActive } from "../../shared/browser/screen-activity";

const entries = /* @__PURE__ */ routeHistory("catalog");

/**
 * Owns only this mounted catalog's history entries.
 * Before the data arrives the URL still moves; cards and validation wait.
 */
export function useCatalogNavigation(catalog: CardCatalog | null) {
  const records = /* @__PURE__ */ useRecords();
  const [href, setHref] = useState(() =>
    typeof window === "undefined" ? "/cards" : window.location.href,
  );
  const raw = useMemo(() => readCatalogUrl(href), [href]);
  const cardIds = useMemo(
    () => catalog && new Set(catalog.cardsById.keys()),
    [catalog],
  );
  const matchReceipt =
    import.meta.env.VITE_ACCOUNTS_ENABLED === "true"
      ? records.matches
      : undefined;
  const cards = useMemo(() => {
    if (!catalog) return [];
    const cards = catalogCards(catalog, { pref: raw.pref, q: raw.q });
    return matchReceipt ? cards.filter((card) => matchReceipt(card.id)) : cards;
  }, [catalog, raw.pref, raw.q, matchReceipt]);
  const state = useMemo(
    () =>
      cardIds
        ? readCatalogUrl(href, {
            cardIds,
            totalPages: Math.max(
              1,
              Math.ceil(cards.length / CATALOG_PAGE_SIZE),
            ),
          })
        : raw,
    [href, raw, cardIds, cards.length],
  );
  const page = useMemo(
    () => paginateCards(cards, state.page),
    [cards, state.page],
  );
  const resultsHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => entries.subscribe(() => setHref(window.location.href)), []);
  // A card opens on its own page. `?card=` is a link from when the list
  // showed the detail itself; `state.card` is set only for a known card.
  const leavingFor = catalog && state.card ? cardPageUrl(state.card) : null;
  const active = useScreenActive();
  useEffect(() => {
    // The list stays mounted while the map is shown, and the data may arrive
    // then: only the list's own entry, still the one read here, is replaced.
    if (leavingFor && active && entries.owns() && window.location.href === href)
      replaceDocument(leavingFor);
  }, [leavingFor, active, href]);
  const navigate = useCallback((next: CatalogUrlState, replace = false) => {
    // While another screen's entry is current, the shown state stays as it is.
    if (!entries.owns()) return;
    entries[replace ? "replace" : "push"](
      mergeCatalogHistoryState(entries.state(), { card: null }),
      catalogUrl({ ...next, card: null }),
    );
    setHref(window.location.href);
  }, []);
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
    changePage,
    resultsHeading,
    leavingFor,
  };
}
