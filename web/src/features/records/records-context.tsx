import { createContext, useContext } from "react";
import type { Receipt, ReceiptFilter } from "../../domain/records";
import type { Owner } from "../../session/session-guard";
export type Phase = "signed-out" | "loading" | "ready" | "failed";
export type ReceiptDetail = Receipt & { memo: string | null };
export type RecordDetail = {
  revision: number;
  record: ReceiptDetail | null;
  loaded: boolean;
  pending: boolean;
  status: string;
  loadError: string;
  saveError: string;
};
export const emptyDetail: RecordDetail = {
  revision: 0,
  record: null,
  loaded: false,
  pending: false,
  status: "",
  loadError: "",
  saveError: "",
};
export type Records = {
  /**
   * Whose the private values are (the records, the details, the friend's
   * name, the notification): the owner they were read or taken as, or null
   * for a value that holds none of a user's.
   */
  owner: Owner | null;
  /**
   * Whether what was got as `owner` may still be drawn, with no side
   * effect (the guard's `owns`): `useRecords` checks it as each part draws.
   */
  owns(owner: Owner): boolean;
  friendName?: string;
  phase: Phase;
  records: ReadonlyMap<string, Receipt> | null;
  filter: ReceiptFilter;
  setFilter(filter: ReceiptFilter): void;
  matches(id: string): boolean;
  details: ReadonlyMap<string, RecordDetail>;
  load(id: string): Promise<void>;
  save(id: string, record: ReceiptDetail | null): Promise<void>;
  /** The detail of `id` has closed; drops a receipt held for its read. */
  abandon(id: string): void;
  notification: string;
};
export const inactive: Records = {
  owner: null,
  owns: () => false,
  phase: "signed-out",
  records: null,
  filter: "all",
  setFilter() {},
  matches: () => true,
  details: new Map(),
  load: async () => {},
  save: async () => {},
  abandon() {},
  notification: "",
};
/** A stable default for callers that have no alias table yet. */
export const NO_ALIASES: Record<string, string> = {};
export const RecordsContext = /* @__PURE__ */ createContext<Records>(inactive);
const NO_DETAILS: ReadonlyMap<string, RecordDetail> = new Map();
// One hidden value for each value held back, so a part drawn again with it
// gets the same object (and memos that depend on it stay).
const hidden = new WeakMap<Records, Records>();
function hide(value: Records): Records {
  let found = hidden.get(value);
  if (!found) {
    found = {
      ...value,
      phase: "loading",
      records: null,
      details: NO_DETAILS,
      notification: "",
      matches: () => true,
      ...(value.friendName !== undefined && { friendName: "" }),
    };
    hidden.set(value, found);
  }
  return found;
}
/**
 * The records the part draws, checked as it draws (PF-5 A): the context's
 * value is handed on as it was when its provider last drew, and the cookies
 * may name another user by the time a part draws on its own (a press, a
 * detail opened). Once the owner they were got as is not the guard's and
 * the cookies', the part is handed them loading, with nothing of that
 * user's, until a press, an answer or a return finds the change and starts
 * them again. No side effect: reading the cookies only.
 */
export function useRecords() {
  const value = useContext(RecordsContext);
  return value.owner === null || value.owns(value.owner) ? value : hide(value);
}
