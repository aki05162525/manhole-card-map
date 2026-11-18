import type { D1Database } from "./env";
import {
  canonicalRecoveryCode,
  recoveryCodeAlphabet,
  recoveryCodeCount,
  recoveryCodeLength,
  showRecoveryCode,
} from "../src/contract/recovery-codes";
import { sha256Hex } from "./encoding";

// Crockford Base32 (AU-8): each symbol carries 5 of the random bits.
function newCode() {
  const bytes = crypto.getRandomValues(
    new Uint8Array((recoveryCodeLength * 5) / 8),
  );
  let bits = 0n;
  for (const byte of bytes) bits = (bits << 8n) | BigInt(byte);
  let code = "";
  for (let index = recoveryCodeLength - 1; index >= 0; index--)
    code += recoveryCodeAlphabet[Number((bits >> BigInt(index * 5)) & 31n)];
  return code;
}

// Accepts what a person may type: any case, spaces or hyphens, and the
// Crockford look-alikes I, L and O.
export function canonicalCode(input: unknown) {
  if (typeof input !== "string") return undefined;
  const code = input
    .toUpperCase()
    .replace(/[\s-]/g, "")
    .replace(/[IL]/g, "1")
    .replace(/O/g, "0");
  return canonicalRecoveryCode.test(code) ? code : undefined;
}

// Statements that replace every code of the user, for one batch; the plain
// codes leave the Worker only in this response.
export async function replaceCodes(db: D1Database, userId: string) {
  const codes = Array.from({ length: recoveryCodeCount }, newCode);
  const statements = [
    db.prepare("DELETE FROM recovery_codes WHERE user_id = ?").bind(userId),
  ];
  for (const code of codes)
    statements.push(
      db
        .prepare(
          "INSERT INTO recovery_codes (code_hash, user_id) VALUES (?, ?)",
        )
        .bind(await sha256Hex(code), userId),
    );
  return { codes: codes.map(showRecoveryCode), statements };
}
