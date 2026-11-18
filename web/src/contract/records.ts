import { longerThan } from "./text";

// The rules the record form checks before sending and the API enforces.
// An empty field (the form) or null (the API) means "unset"; each boundary
// handles that before calling these.

export const memoMax = 500;

export const memoTooLong = (memo: string) => longerThan(memo, memoMax);

// A YYYY-MM-DD day that exists on the calendar and is not after `today`,
// the Japanese calendar day (japanDate) of the caller's clock.
export function isReceiptDate(value: string, today: string) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    value.startsWith("0000") ||
    value > today
  )
    return false;
  const date = new Date(value);
  return (
    Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}
