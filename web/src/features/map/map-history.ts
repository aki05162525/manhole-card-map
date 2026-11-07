// Initial browser history entries have no application state.
export function focusFromHistory(
  state: { mapFocus?: import("./map-levels").MapFocus } | null,
) {
  return state?.mapFocus ?? { area: null, pref: null };
}
