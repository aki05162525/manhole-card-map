import { longerThan } from "../src/contract/text";
import { isSealFrame, isSealInk, type Seal } from "../src/contract/seal";
import type { ErrorCode } from "../src/contract/api-errors";
import { HttpError } from "./http";

// One field of a JSON body that may be anything.
export const field = (body: unknown, key: string): unknown =>
  typeof body === "object" && body !== null
    ? Reflect.get(body, key)
    : undefined;

// Control characters, lone surrogates, bidi controls and line separators;
// the ZWJ of emoji sequences stays allowed (AZ-8).
const forbidden =
  /[\p{Cc}\p{Cs}\u061C\u200E\u200F\u202A-\u202E\u2066-\u2069\u2028\u2029]/u;

// NFC, trimmed, 1 to `max` graphemes. Rendering escapes the rest.
export function readName(value: unknown, max: number, code: ErrorCode) {
  if (typeof value !== "string") throw new HttpError(code);
  const name = value.normalize("NFC").trim();
  if (!name || forbidden.test(name) || longerThan(name, max))
    throw new HttpError(code);
  return name;
}

export const readDisplayName = (value: unknown) =>
  readName(value, 20, "invalid_display_name");

// One character as a person sees it, and short as stored: a single grapheme
// may carry any number of combining marks.
export function readSeal(value: unknown): Seal {
  const frame = field(value, "frame");
  const ink = field(value, "ink");
  const char = field(value, "char");
  if (!isSealFrame(frame) || !isSealInk(ink))
    throw new HttpError("invalid_seal");
  if (char === null) return { frame, ink, char };
  const read = readName(char, 1, "invalid_seal");
  if (read.length > 16) throw new HttpError("invalid_seal");
  return { frame, ink, char: read };
}
