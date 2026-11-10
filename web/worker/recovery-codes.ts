import type { D1Database } from "./env";
import { sha256Hex } from "./encoding";

// Crockford Base32 (AU-8): 16 symbols carry 80 random bits.
const alphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const canonical = /^[0-9A-HJKMNP-TV-Z]{16}$/;

function newCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  let bits = 0n;
  for (const byte of bytes) bits = (bits << 8n) | BigInt(byte);
  let code = "";
  for (let index = 15; index >= 0; index--)
    code += alphabet[Number((bits >> BigInt(index * 5)) & 31n)];
  return code;
}

const display = (code: string) => code.match(/.{4}/g)!.join("-");

// Accepts what a person may type: any case, spaces or hyphens, and the
// Crockford look-alikes I, L and O.
export function canonicalCode(input: unknown) {
  if (typeof input !== "string") return undefined;
  const code = input
    .toUpperCase()
    .replace(/[\s-]/g, "")
    .replace(/[IL]/g, "1")
    .replace(/O/g, "0");
  return canonical.test(code) ? code : undefined;
}

export const hashCode = sha256Hex;

// Statements that replace every code of the user, for one batch; the plain
// codes leave the Worker only in this response.
export async function replaceCodes(db: D1Database, userId: string) {
  const codes = Array.from({ length: 10 }, newCode);
  const statements = [
    db.prepare("DELETE FROM recovery_codes WHERE user_id = ?").bind(userId),
  ];
  for (const code of codes)
    statements.push(
      db
        .prepare(
          "INSERT INTO recovery_codes (code_hash, user_id) VALUES (?, ?)",
        )
        .bind(await hashCode(code), userId),
    );
  return { codes: codes.map(display), statements };
}
