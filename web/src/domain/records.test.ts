import { expect, it, vi, afterEach } from "vitest";
import { japanToday, validReceiptDate, receiptPins } from "./records";
import type { Pin } from "./types";
const pins: Pin[] = [
  {
    id: "shared",
    cardIds: ["a", "b"],
    pref: "東京都",
    kind: "place",
    status: "suspended",
    lat: 35,
    lng: 139,
    reference: false,
  },
];
afterEach(() => vi.useRealTimers());
it("distinguishes all, some and none while retaining distribution colors", () => {
  for (const [ids, state] of [
    [[], "none"],
    [["a"], "some"],
    [["a", "b"], "all"],
  ] as const) {
    const records = new Map(
      ids.map((id) => [id, { cardId: id, receivedOn: null }]),
    );
    const pin = receiptPins(pins, records, "all")[0];
    expect(pin).toMatchObject({
      status: "suspended",
      receipt: state,
    });
  }
  expect(receiptPins(pins, null, "unreceived")).toBe(pins);
});
it("filters individual cards of shared pins without calling a partial receipt complete", () => {
  const records = new Map([["a", { cardId: "a", receivedOn: null }]]);
  expect(receiptPins(pins, records, "received")[0]).toMatchObject({
    cardIds: ["a"],
    receipt: "some",
  });
  expect(receiptPins(pins, records, "unreceived")[0]).toMatchObject({
    cardIds: ["b"],
    receipt: "some",
  });
});
it("uses the same Japanese date boundary as the API and validates calendar dates", () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-10T14:59:59.999Z"));
  expect(japanToday()).toBe("2026-11-10");
  expect(validReceiptDate("2026-11-11")).toBe(false);
  vi.setSystemTime(new Date("2026-11-10T15:00:00Z"));
  expect(japanToday()).toBe("2026-11-11");
  expect(validReceiptDate("2026-11-11")).toBe(true);
  for (const value of ["2026-11-12", "2026-02-30", "0000-01-01", "bad"])
    expect(validReceiptDate(value)).toBe(false);
  expect(validReceiptDate("")).toBe(true);
});
