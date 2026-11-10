import { createContext, useContext } from "react";
import type { Receipt, ReceiptFilter } from "../../domain/records";
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
  friendName?: string;
  phase: Phase;
  records: ReadonlyMap<string, Receipt> | null;
  filter: ReceiptFilter;
  setFilter(filter: ReceiptFilter): void;
  matches(id: string): boolean;
  details: ReadonlyMap<string, RecordDetail>;
  load(id: string): Promise<void>;
  save(id: string, record: ReceiptDetail | null): Promise<void>;
  notification: string;
};
export const inactive: Records = {
  phase: "signed-out",
  records: null,
  filter: "all",
  setFilter() {},
  matches: () => true,
  details: new Map(),
  load: async () => {},
  save: async () => {},
  notification: "",
};
export const RecordsContext = /* @__PURE__ */ createContext<Records>(inactive);
export function useRecords() {
  return useContext(RecordsContext);
}
