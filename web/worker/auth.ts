import type { Context, Route } from "./app";
import { HttpError, json } from "./http";
import { field, readDisplayName } from "./names";
import { canonicalCode, hashCode, replaceCodes } from "./recovery-codes";
import {
  createSession,
  endSession,
  markVerified,
  requireSession,
} from "./session";
import {
  authenticationOptions,
  newUserId,
  registrationOptions,
  verifyAuthentication,
  verifyRegistration,
  type StoredCredential,
} from "./webauthn";

const MINUTE = 60 * 1000;
// AU-10: failures across all users per window before recovery pauses.
const RECOVERY_WINDOW = 10 * MINUTE;
const RECOVERY_PAUSE_AFTER = 100;

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
export async function insertCredential(
  context: Context,
  userId: string,
  credential: {
    id: string;
    publicKey: Uint8Array;
    counter: number;
    transports?: string[];
  },
) {
  if (await credentialExists(context, credential.id))
    throw new HttpError(400, "invalid_credential");
  return context.env.DB.prepare(
    `INSERT INTO credentials (id, user_id, public_key, sign_count, transports, label, created_at)
    SELECT ?1, ?2, ?3, ?4, ?5,
      'パスキー ' || ((SELECT count(*) FROM credentials WHERE user_id = ?2) + 1), ?6
    WHERE (SELECT count(*) FROM credentials WHERE user_id = ?2) < 10
    RETURNING id`,
  ).bind(
    credential.id,
    userId,
    credential.publicKey,
    credential.counter,
    JSON.stringify(credential.transports ?? []),
    context.now,
  );
}

export const authRoutes: Route[] = [
  {
    method: "POST",
    path: "/api/auth/register/options",
    handle: async (context) => {
      readDisplayName(field(context.body, "displayName"));
      return json(
        await registrationOptions(context, "register", {
          id: newUserId(),
          createdAt: context.now,
        }),
      );
    },
  },
  {
    method: "POST",
    path: "/api/auth/register/verify",
    body: "webauthn",
    handle: async (context) => {
      const displayName = readDisplayName(field(context.body, "displayName"));
      const { userId, credential } = await verifyRegistration(
        context,
        field(context.body, "response"),
        "register",
      );
      const { DB } = context.env;
      const recovery = await replaceCodes(DB, userId);
      await DB.batch([
        DB.prepare(
          "INSERT INTO users (id, display_name, created_at) VALUES (?, ?, ?)",
        ).bind(userId, displayName, context.now),
        await insertCredential(context, userId, credential),
        ...recovery.statements,
      ]);
      await createSession(context, userId, "normal");
      return json({
        ...(await profile(context, userId)),
        recoveryCodes: recovery.codes,
      });
    },
  },
  {
    method: "POST",
    path: "/api/auth/login/options",
    // Discoverable credentials: the browser picks the account.
    handle: async (context) =>
      json(await authenticationOptions(context, "login")),
  },
  {
    method: "POST",
    path: "/api/auth/login/verify",
    body: "webauthn",
    handle: async (context) => {
      const userId = await verifyAuthentication(
        context,
        field(context.body, "response"),
        "login",
      );
      await createSession(context, userId, "normal");
      return json(await profile(context, userId));
    },
  },
  {
    method: "POST",
    path: "/api/auth/logout",
    handle: async (context) => {
      await endSession(context);
      return json({ ok: true });
    },
  },
  {
    method: "POST",
    path: "/api/auth/recover",
    handle: async (context) => {
      const { DB, RECOVERY_LIMITER } = context.env;
      // The IP is used for this check only and never stored (PR-3).
      if (RECOVERY_LIMITER) {
        const key = context.request.headers.get("CF-Connecting-IP") ?? "";
        if (!(await RECOVERY_LIMITER.limit({ key })).success)
          throw new HttpError(429, "too_many_requests");
      }
      const bucket = Math.floor(context.now / RECOVERY_WINDOW);
      const counted = await DB.prepare(
        "SELECT failures FROM recovery_failures WHERE bucket = ?",
      )
        .bind(bucket)
        .first<{ failures: number }>();
      if (counted && counted.failures >= RECOVERY_PAUSE_AFTER)
        throw new HttpError(429, "recovery_paused", {
          "Retry-After": String(
            Math.ceil(((bucket + 1) * RECOVERY_WINDOW - context.now) / 1000),
          ),
        });
      const code = canonicalCode(field(context.body, "code"));
      // The conditional UPDATE lets exactly one request spend a code (AU-8).
      const used =
        code &&
        (await DB.prepare(
          "UPDATE recovery_codes SET used_at = ? WHERE code_hash = ? AND used_at IS NULL RETURNING user_id",
        )
          .bind(context.now, await hashCode(code))
          .first<{ user_id: string }>());
      if (!used) {
        await DB.batch([
          DB.prepare(
            "INSERT INTO recovery_failures (bucket, failures) VALUES (?, 1) ON CONFLICT (bucket) DO UPDATE SET failures = failures + 1",
          ).bind(bucket),
          DB.prepare("DELETE FROM recovery_failures WHERE bucket < ?").bind(
            bucket,
          ),
        ]);
        throw new HttpError(400, "invalid_code");
      }
      await DB.prepare("DELETE FROM recovery_failures WHERE bucket < ?")
        .bind(bucket)
        .run();
      await createSession(context, used.user_id, "recovery");
      return json({ ok: true });
    },
  },
  {
    method: "POST",
    path: "/api/auth/reauth/options",
    handle: async (context) => {
      const { userId } = await requireSession(context);
      return json(
        await authenticationOptions(context, "reauth", {
          id: userId,
          credentials: await credentialsOf(context, userId),
        }),
      );
    },
  },
  {
    method: "POST",
    path: "/api/auth/reauth/verify",
    body: "webauthn",
    handle: async (context) => {
      const session = await requireSession(context);
      const owner = await verifyAuthentication(
        context,
        field(context.body, "response"),
        "reauth",
      );
      if (owner !== session.userId)
        throw new HttpError(400, "invalid_credential");
      await markVerified(context, session);
      return json({ ok: true });
    },
  },
];
