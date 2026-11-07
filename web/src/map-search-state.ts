export type MapSearchSession = {
  phase: "map" | "search" | "detail";
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
    limit: 50,
    scroll: 0,
    selected: null,
    owner: null,
    restore: false,
    ...value,
  };
}
export function withMapSearch(state: unknown, session: MapSearchSession) {
  return {
    ...(state && typeof state === "object" ? state : {}),
    mapSearch: session,
  };
}
export function readMapSearch(state: unknown): MapSearchSession {
  const value = (state as { mapSearch?: MapSearchSession } | null)?.mapSearch;
  return searchSession(value && typeof value.query === "string" ? value : {});
}
export function mapSearchScreen(
  session: MapSearchSession,
  card: string | null,
) {
  return session.phase === "search" ? "S" : card ? "D" : "M";
}
