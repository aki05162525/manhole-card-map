import { japanDate } from "../contract/japan-time";
import type { Pin } from "./types";

export type Receipt = { cardId: string; receivedOn: string | null };
export type ReceiptFilter = "all" | "received" | "unreceived";
export type ReceiptState = "all" | "some" | "none";

/** Whether an API row has the shape of a receipt. */
export const isReceipt = (row: Receipt | null | undefined) =>
  !!row &&
  typeof row.cardId === "string" &&
  (row.receivedOn === null || typeof row.receivedOn === "string");

/** Receipts by current card number; `aliases` maps old numbers to current ones. */
export function receiptsByCard(
  rows: Receipt[],
  aliases: Record<string, string>,
): Map<string, Receipt> {
  return new Map(
    rows.map((row) => {
      const cardId = aliases[row.cardId] ?? row.cardId;
      return [cardId, { cardId, receivedOn: row.receivedOn }];
    }),
  );
}

/** Without records (signed out, still loading) every card matches. */
export const matchesReceiptFilter = (
  records: ReadonlyMap<string, Receipt> | null,
  filter: ReceiptFilter,
  id: string,
) =>
  !records || filter === "all" || records.has(id) === (filter === "received");

export function receiptState(
  ids: string[],
  records: ReadonlyMap<string, Receipt>,
): ReceiptState {
  const count = ids.reduce((sum, id) => sum + Number(records.has(id)), 0);
  return count === 0 ? "none" : count === ids.length ? "all" : "some";
}
export function receiptPins(
  pins: Pin[],
  records: ReadonlyMap<string, Receipt> | null,
  filter: ReceiptFilter,
): Pin[] {
  if (!records) return pins;
  return pins.flatMap((pin) => {
    const cardIds = pin.cardIds.filter((id) =>
      matchesReceiptFilter(records, filter, id),
    );
    return cardIds.length
      ? [{ ...pin, cardIds, receipt: receiptState(pin.cardIds, records) }]
      : [];
  });
}
export function japanToday() {
  return japanDate(Date.now());
}
