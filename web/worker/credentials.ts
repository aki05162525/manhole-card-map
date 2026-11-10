import type { Context } from "./app";
import { HttpError } from "./http";
import type { StoredCredential } from "./webauthn";

export async function profile(context: Context, userId: string) {
  const row = await context.env.DB.prepare(
    `SELECT display_name,
      (SELECT count(*) FROM credentials WHERE user_id = users.id) AS passkeys,
      (SELECT count(*) FROM recovery_codes WHERE user_id = users.id AND used_at IS NULL) AS codes
    FROM users WHERE id = ?`,
  )
    .bind(userId)
    .first<{ display_name: string; passkeys: number; codes: number }>();
  if (!row) throw new HttpError(401, "unauthorized");
  return {
    displayName: row.display_name,
    passkeys: row.passkeys,
    recoveryCodesRemaining: row.codes,
  };
}

export const credentialsOf = async (context: Context, userId: string) =>
  (
    await context.env.DB.prepare(
      "SELECT id, user_id, public_key, sign_count, transports FROM credentials WHERE user_id = ? ORDER BY created_at, id",
    )
      .bind(userId)
      .all<StoredCredential>()
  ).results;

const credentialExists = async (context: Context, id: string) =>
  !!(await context.env.DB.prepare("SELECT 1 FROM credentials WHERE id = ?")
    .bind(id)
    .first());

// Stores a verified credential unless the user already has ten (AU-12).
// Recovery may go past the limit, or an account with ten passkeys could not
// recover; the extra one can be deleted once the session is normal.
export async function insertCredential(
  context: Context,
  userId: string,
  credential: {
    id: string;
    publicKey: Uint8Array;
    counter: number;
    transports?: string[];
  },
  { limit = true } = {},
) {
  if (await credentialExists(context, credential.id))
    throw new HttpError(400, "invalid_credential");
  return context.env.DB.prepare(
    `INSERT INTO credentials (id, user_id, public_key, sign_count, transports, label, created_at)
    SELECT ?1, ?2, ?3, ?4, ?5,
      'パスキー ' || ((SELECT count(*) FROM credentials WHERE user_id = ?2) + 1), ?6
    WHERE ?7 OR (SELECT count(*) FROM credentials WHERE user_id = ?2) < 10
    RETURNING id`,
  ).bind(
    credential.id,
    userId,
    credential.publicKey,
    credential.counter,
    JSON.stringify(credential.transports ?? []),
    context.now,
    limit ? 0 : 1,
  );
}
