/** Results shown at first, and added by each "show more". */
export const SEARCH_PAGE = 50;
const PHASES = ["map", "search", "detail"] as const;
export type MapSearchSession = {
  phase: (typeof PHASES)[number];
  query: string;
  limit: number;
  scroll: number;
  selected: string | null;
  owner: string | null;
  restore: boolean;
};
export function searchSession(
  value: Partial<MapSearchSession> = {},
): MapSearchSession {
  return {
    phase: "map",
    query: "",
    limit: SEARCH_PAGE,
    scroll: 0,
    selected: null,
    owner: null,
    restore: false,
    ...value,
  };
}
const isFields = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
/** Fields of a history state, or none when it is not an object. */
export function historyFields(state: unknown): Record<string, unknown> {
  return isFields(state) ? state : {};
}
export function withMapSearch(state: unknown, session: MapSearchSession) {
  return { ...historyFields(state), mapSearch: session };
}
/**
 * The search a history entry holds. An entry may predate a field or come
 * from older code, so each field is read on its own, and one that is
 * missing, of another type or out of range takes its `searchSession()`
 * default: the map phase, an empty query, one page of results (a whole
 * number of at least one page), the top of the list (a finite position of
 * zero or more), nothing selected, no owner, and no restore.
 */
export function readMapSearch(state: unknown): MapSearchSession {
  const value = historyFields(historyFields(state).mapSearch);
  const { phase, query, limit, scroll, selected, owner, restore } = value;
  const known = PHASES.find((name) => name === phase);
  const text = (field: unknown) => (typeof field === "string" ? field : null);
  return searchSession({
    ...(known && { phase: known }),
    ...(typeof query === "string" && { query }),
    ...(typeof limit === "number" &&
      Number.isSafeInteger(limit) &&
      limit >= SEARCH_PAGE && { limit }),
    ...(typeof scroll === "number" &&
      Number.isFinite(scroll) &&
      scroll >= 0 && { scroll }),
    selected: text(selected),
    owner: text(owner),
    restore: restore === true,
  });
}
function sameMapSearch(a: MapSearchSession, b: MapSearchSession) {
  return (
    a.phase === b.phase &&
    a.query === b.query &&
    a.limit === b.limit &&
    a.scroll === b.scroll &&
    a.selected === b.selected &&
    a.owner === b.owner &&
    a.restore === b.restore
  );
}
type ShownSearch = { url: string; search: MapSearchSession };
/**
 * What the map shows on arriving at one of its entries: by back or forward
 * (`traversed`), or when it mounts. `shown` is what it showed until then,
 * and `latest` the search as last typed, which may still wait to be written.
 * Returns null for an entry that changes neither the URL nor the search (the
 * sheet's own entry), else the search to show and whether the entry must be
 * written to hold it:
 * - a map entry takes the search as last typed, as the search left for the
 *   map is kept for the next time it opens;
 * - a search entry is restored to the list position it saved;
 * - a detail entry opened from the search is shown as it was written.
 */
export function restoreMapSearch({
  traversed,
  arrived,
  shown,
  latest,
}: {
  traversed: boolean;
  arrived: ShownSearch;
  shown: ShownSearch;
  latest: MapSearchSession;
}): { search: MapSearchSession; write: boolean } | null {
  if (
    traversed &&
    arrived.url === shown.url &&
    sameMapSearch(arrived.search, shown.search)
  )
    return null;
  const stored = arrived.search;
  const search =
    stored.phase === "map"
      ? {
          ...stored,
          query: latest.query,
          limit: latest.limit,
          scroll: latest.scroll,
          selected: latest.selected,
        }
      : stored.phase === "search"
        ? { ...stored, restore: true }
        : stored;
  return { search, write: !sameMapSearch(search, stored) };
}
export function mapSearchScreen(
  session: MapSearchSession,
  card: string | null,
) {
  return session.phase === "search" ? "S" : card ? "D" : "M";
}
