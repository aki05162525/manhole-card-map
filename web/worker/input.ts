import { longerThan } from "../src/contract/text";
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
