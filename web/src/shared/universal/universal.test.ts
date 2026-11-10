import { expect, it } from "vitest";
import { base64url, fromBase64url } from "./base64url";
import { JST, japanDate } from "./japan-time";

it("turns the Japanese calendar day at 15:00 UTC", () => {
  expect(JST).toBe(32_400_000);
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
  for (const size of [0, 1, 2, 3, 4, 255, 256]) {
    const part = bytes.subarray(256 - size);
    const text = base64url(part);
    expect(text).toBe(Buffer.from(part).toString("base64url"));
    expect(text).toMatch(/^[\w-]*$/);
    expect(fromBase64url(text)).toEqual(part);
  }
  expect(base64url(Uint8Array.of(0xfb, 0xff, 0xfe))).toBe("-__-");
  expect(fromBase64url("-__-")).toEqual(Uint8Array.of(0xfb, 0xff, 0xfe));
  // Padded and standard-alphabet input decodes too; other text throws.
  expect(fromBase64url("+/8=")).toEqual(Uint8Array.of(0xfb, 0xff));
  expect(() => fromBase64url("a b!")).toThrow();
});
