import { expect, it, vi } from "vitest";
import { base64url, fromBase64url } from "./base64url";
import { japanDate } from "./japan-time";
import { isReceiptDate, memoTooLong } from "./records";
import { graphemeCount } from "./text";

it("turns the Japanese calendar day at 15:00 UTC", () => {
  expect(japanDate(Date.UTC(2026, 10, 10, 14, 59, 59, 999))).toBe("2026-11-10");
  expect(japanDate(Date.UTC(2026, 10, 10, 15))).toBe("2026-11-11");
  // Year and leap-day boundaries.
  expect(japanDate(Date.UTC(2026, 11, 31, 14, 59, 59, 999))).toBe("2026-12-31");
  expect(japanDate(Date.UTC(2026, 11, 31, 15))).toBe("2027-01-01");
  expect(japanDate(Date.UTC(2028, 1, 28, 15))).toBe("2028-02-29");
  expect(japanDate(0)).toBe("1970-01-01");
});

it("encodes bytes as unpadded base64url and decodes them back", () => {
  const bytes = Uint8Array.from({ length: 256 }, (_, index) => index);
  // Empty, each padding length, and all byte values (including both URL symbols).
  for (const size of [0, 1, 2, 3, 256]) {
    const part = bytes.subarray(256 - size);
    const encoded = Buffer.from(part).toString("base64url");
    expect(base64url(part)).toBe(encoded);
    expect(fromBase64url(encoded)).toEqual(part);
  }
  // Padded and standard-alphabet input decodes too; other text throws.
  expect(fromBase64url("+/8=")).toEqual(Uint8Array.of(0xfb, 0xff));
  expect(() => fromBase64url("a b!")).toThrow();
});

it("accepts receipt dates that exist on the calendar and are not after today", () => {
  const today = "2026-11-11";
  for (const value of [
    "2024-02-29",
    "2000-02-29",
    "2026-01-31",
    "2026-04-30",
    "2025-12-31",
    "0001-01-01",
    today,
  ])
    expect(isReceiptDate(value, today), value).toBe(true);
  for (const value of [
    "2026-02-29",
    "1900-02-29",
    "2026-01-32",
    "2026-04-31",
    "2026-00-01",
    "2026-13-01",
    "2026-11-12",
    "2027-01-01",
    "0000-01-01",
    "2026-1-01",
    " 2026-11-01",
    "2026-11-01T00:00",
    "２０２６-11-01",
    "",
  ])
    expect(isReceiptDate(value, today), value).toBe(false);
  expect(isReceiptDate("2028-02-29", "2028-02-29")).toBe(true);
});

it("takes today from the Japanese calendar day passed in", () => {
  const before = japanDate(Date.UTC(2026, 10, 10, 14, 59, 59, 999));
  const after = japanDate(Date.UTC(2026, 10, 10, 15));
  expect(isReceiptDate("2026-11-11", before)).toBe(false);
  expect(isReceiptDate("2026-11-11", after)).toBe(true);
});

it("counts memo length in graphemes and allows exactly 500", () => {
  const family = "👨\u200D👩\u200D👧\u200D👦";
  for (const unit of [
    "a",
    "𠮷",
    family,
    "🇯🇵",
    "👍🏽",
    "e\u0301",
    "か\u3099",
    "\r\n",
  ]) {
    expect(graphemeCount(unit), unit).toBe(1);
    expect(memoTooLong(unit.repeat(500)), unit).toBe(false);
    expect(memoTooLong(unit.repeat(501)), unit).toBe(true);
  }
  // A combining mark joins the grapheme before it.
  expect(memoTooLong("a".repeat(500) + "\u0301\u0301")).toBe(false);
  expect(graphemeCount(family.repeat(500) + "a")).toBe(501);
  expect(memoTooLong("")).toBe(false);
});

it("loads and counts without Intl.Segmenter, never fewer than graphemes", async () => {
  const segmenter = Intl.Segmenter;
  Reflect.deleteProperty(Intl, "Segmenter");
  try {
    vi.resetModules();
    const text = await import("./text");
    const records = await import("./records");
    // Code points: the family emoji is 5, so the screen warns early, not late.
    expect(text.graphemeCount("ab")).toBe(2);
    expect(text.graphemeCount("👨‍👩‍👧")).toBe(5);
    expect(records.memoTooLong("a".repeat(500))).toBe(false);
    expect(records.memoTooLong("a".repeat(501))).toBe(true);
  } finally {
    Object.defineProperty(Intl, "Segmenter", {
      value: segmenter,
      configurable: true,
      writable: true,
    });
    vi.resetModules();
  }
});
