/**
 * Which switch between screens the document still waits for. Every link
 * followed and every back or forward starts one, and a later one takes the
 * place of any still loading: only the last may show its screen or, when
 * that fails, hand its URL to the browser. An earlier one that settles after
 * does nothing, so it cannot undo the screen the user chose since.
 */
export type Switches = { readonly latest: number };

export const noSwitch: Switches = { latest: 0 };

/**
 * Starts a switch, which ends any still loading. A link followed from a
 * screen the history has already left, while a back or forward still loads
 * the screen of its entry, cannot be switched to from there: it opens its URL
 * as a document at once. A back or forward is always in place.
 */
export function startSwitch(state: Switches, { inPlace = true } = {}) {
  const id = state.latest + 1;
  return {
    state: { latest: id },
    id,
    action: inPlace ? ("load" as const) : ("fallback" as const),
  };
}

export type Settled = {
  id: number;
  /** The screen loaded; false when its code could not be. */
  loaded: boolean;
  /** The history is still at the entry the switch started from or went to. */
  inPlace: boolean;
};

/**
 * What a switch does once its screen has loaded or failed to: show it, open
 * its URL as a document instead, or nothing, when no longer waited for.
 */
export function settleSwitch(
  state: Switches,
  { id, loaded, inPlace }: Settled,
): "show" | "fallback" | "drop" {
  if (id !== state.latest || !inPlace) return "drop";
  return loaded ? "show" : "fallback";
}
