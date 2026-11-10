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
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
export function validReceiptDate(value: string) {
  if (!value) return true;
  const date = new Date(value + "T00:00:00Z");
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !value.startsWith("0000") &&
    Number.isFinite(date.getTime()) &&
    date.toISOString().slice(0, 10) === value &&
    value <= japanToday()
  );
}
export function memoLength(memo: string) {
  const segmenter = new Intl.Segmenter("ja", { granularity: "grapheme" });
  return Array.from(segmenter.segment(memo)).length;
}
