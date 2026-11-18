import type { SheetState } from "../../features/map/detail-sheet";

export type PendingActions = {
  map?: (() => void) | undefined;
  group?: (() => void) | undefined;
  close?: true | undefined;
  collapse?: true | undefined;
};

type Request =
  | { map: () => void }
  | { group: () => void }
  | { close: true }
  | { collapse: true };

// A request outside full view can run immediately without waiting for history.
export function reserve(
  full: boolean,
  pending: PendingActions,
  request: Request,
) {
  return full ? { ...pending, ...request } : null;
}

export function release({ group, close }: PendingActions): PendingActions {
  return { group, close };
}

export function takeMap({ map, ...pending }: PendingActions) {
  return { move: map, pending };
}

export function expandDetail(
  state: SheetState,
  mobile: boolean,
  swipe: boolean,
) {
  if (!mobile || state === "full") return "stay";
  return state === "collapsed" && !swipe ? "summary" : "full";
}

export function restoreDetail(full: boolean, actions: PendingActions) {
  const state: SheetState = full
    ? "full"
    : actions.collapse
      ? "collapsed"
      : "summary";
  return {
    state,
    opening: full,
    pending: { map: actions.map },
    choose: actions.group,
    close: actions.close,
  };
}
