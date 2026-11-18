import type { Context } from "./app";
import { HttpError } from "./http";
import { providerName } from "./passkey-providers";
import type { StoredCredential } from "./webauthn";

// The profile of the user given as an SQL expression.
export const profileSql = (user: string) =>
  `SELECT id, display_name,
    (SELECT count(*) FROM credentials WHERE user_id = users.id) AS passkeys,
    (SELECT count(*) FROM recovery_codes WHERE user_id = users.id AND used_at IS NULL) AS codes
  FROM users WHERE id = ${user}`;

export type ProfileRow = {
  id: string;
  display_name: string;
  passkeys: number;
  codes: number;
};

// What the browser tells the passkey manager about (the WebAuthn Signal
// API) is named by the RP ID and the user.id of the passkeys. Both come
// from here: the page never derives them from its own address.
export const passkeyAccount = (context: Context, userId: string) => ({
  rpId: context.env.RP_ID,
  userId,
});

export function toProfile(
  context: Context,
  row: ProfileRow | null | undefined,
) {
  if (!row) throw new HttpError(401, "unauthorized");
  return {
    displayName: row.display_name,
    passkeys: row.passkeys,
    recoveryCodesRemaining: row.codes,
    ...passkeyAccount(context, row.id),
  };
}

export const profile = async (context: Context, userId: string) =>
  toProfile(
    context,
    await context.env.DB.prepare(profileSql("?"))
      .bind(userId)
      .first<ProfileRow>(),
  );

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
  // The AAGUID of the registration, kept to show the passkey manager; its
  // name labels the passkey, which is numbered without one.
  aaguid: string,
  { limit = true } = {},
) {
  if (await credentialExists(context, credential.id))
    throw new HttpError(400, "invalid_credential");
  return context.env.DB.prepare(
    `INSERT INTO credentials (id, user_id, public_key, sign_count, transports, label, created_at, aaguid)
    SELECT ?1, ?2, ?3, ?4, ?5,
      coalesce(?8, 'パスキー ' || ((SELECT count(*) FROM credentials WHERE user_id = ?2) + 1)), ?6, ?9
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
    providerName(aaguid),
    aaguid.toLowerCase(),
  );
}
