import type { SheetState } from "../../features/map/detail-sheet";

export type PendingAction =
  | { kind: "collapse" | "close" }
  | { kind: "group"; run: () => void }
  | { kind: "map"; run: () => void };

// A second request of the same kind replaces the first while Back is in flight.
export function reserve(actions: PendingAction[], action: PendingAction) {
  return [...actions.filter((item) => item.kind !== action.kind), action];
}

export function expandDetail(
  state: SheetState,
  mobile: boolean,
  swipe: boolean,
) {
  if (!mobile || state === "full") return "stay";
  return state === "collapsed" && !swipe ? "summary" : "full";
}

export function restoreDetail(full: boolean, actions: PendingAction[]) {
  const state: SheetState = full
    ? "full"
    : actions.some((a) => a.kind === "collapse")
      ? "collapsed"
      : "summary";
  return {
    state,
    opening: full,
    pending: actions.filter((a) => a.kind === "map"),
    choose: actions.find((a) => a.kind === "group")?.run,
    close: actions.some((a) => a.kind === "close"),
  };
}
