import { HttpError } from "./http";

// Control characters, lone surrogates, bidi controls and line separators;
// the ZWJ of emoji sequences stays allowed (AZ-8).
const forbidden =
  /[\p{Cc}\p{Cs}\u061C\u200E\u200F\u202A-\u202E\u2066-\u2069\u2028\u2029]/u;
const graphemes = new Intl.Segmenter("ja", { granularity: "grapheme" });

// NFC, trimmed, 1 to `max` graphemes. Rendering escapes the rest.
export function readName(value: unknown, max: number, code: string) {
  if (typeof value !== "string") throw new HttpError(400, code);
  const name = value.normalize("NFC").trim();
  if (!name || forbidden.test(name)) throw new HttpError(400, code);
  let count = 0;
  for (const _ of graphemes.segment(name))
    if (++count > max) throw new HttpError(400, code);
  return name;
}

export const readDisplayName = (value: unknown) =>
  readName(value, 20, "invalid_display_name");

export const field = (body: unknown, key: string) =>
  typeof body === "object" && body !== null
    ? (body as Record<string, unknown>)[key]
    : undefined;
