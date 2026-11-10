import type { Context, Route } from "./app";
import { credentialsOf, insertCredential, profile } from "./credentials";
import { sha256Hex } from "./encoding";
import type { Env } from "./env";
import { HttpError, json } from "./http";
import { field, readDisplayName } from "./input";
import { canonicalCode, replaceCodes } from "./recovery-codes";
import {
  createSession,
  endSession,
  markVerified,
  requireSession,
} from "./session";
import { MINUTE } from "./time";
import {
  authenticationOptions,
  newUserId,
  registrationOptions,
  verifyAuthentication,
  verifyRegistration,
} from "./webauthn";

// AU-10: failures across all users per window before recovery pauses.
const RECOVERY_WINDOW = 10 * MINUTE;
const RECOVERY_PAUSE_AFTER = 100;
// Accounts created by anyone in the latest 10-minute window before registration
// pauses (AZ-7): a software authenticator makes registrations cheap, and
// each one writes about 13 rows.
const REGISTRATION_WINDOW = 10 * MINUTE;
const REGISTRATIONS_PER_WINDOW = 10;

// An optional Rate Limiting binding keyed by the client IP. The IP is used
// for this check only and never stored (PR-3).
async function limitByIp(context: Context, limiter: Env["RECOVERY_LIMITER"]) {
  if (!limiter) return;
  const key = context.request.headers.get("CF-Connecting-IP") ?? "";
  if (!(await limiter.limit({ key })).success)
    throw new HttpError(429, "too_many_requests");
}

const registrationPaused = (context: Context, windowStart: number) =>
  new HttpError(429, "registration_paused", {
    "Retry-After": String(
      Math.max(
        1,
        Math.ceil((windowStart + REGISTRATION_WINDOW - context.now) / 1000),
      ),
    ),
  });

export const authRoutes: Route[] = [
  {
    method: "POST",
    path: "/api/auth/register/options",
    handle: async (context) => {
      await limitByIp(context, context.env.REGISTRATION_LIMITER);
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
      await limitByIp(context, context.env.REGISTRATION_LIMITER);
      const displayName = readDisplayName(field(context.body, "displayName"));
      const { DB } = context.env;
      const windowStart =
        Math.floor(context.now / REGISTRATION_WINDOW) * REGISTRATION_WINDOW;
      // The latest window, never moved back: a request that started in an
      // older one counts against it (as limitFriendRequests does).
      const full = async () => {
        const row = await DB.prepare(
          "SELECT window_start, count FROM registration_counter WHERE id = 1",
        ).first<{ window_start: number; count: number }>();
        return row &&
          row.window_start >= windowStart &&
          row.count >= REGISTRATIONS_PER_WINDOW
          ? row.window_start
          : undefined;
      };
      // A cheap early answer; the batch below is what enforces the limit.
      const early = await full();
      if (early !== undefined) throw registrationPaused(context, early);
      const { userId, credential, spend } = await verifyRegistration(
        context,
        field(context.body, "response"),
        "register",
      );
      const recovery = await replaceCodes(DB, userId);
      const insert = await insertCredential(context, userId, credential);
      await spend();
      // One transaction takes a slot and creates the account. Past the
      // limit the display name becomes NULL, the INSERT fails and the slot
      // is given back with the rollback, so racing requests cannot overrun.
      try {
        await DB.batch([
          DB.prepare(
            "INSERT INTO registration_counter (id, window_start, count) VALUES (1, ?, 1) ON CONFLICT (id) DO UPDATE SET count = CASE WHEN excluded.window_start > window_start THEN 1 ELSE count + 1 END, window_start = max(window_start, excluded.window_start)",
          ).bind(windowStart),
          DB.prepare(
            "INSERT INTO users (id, display_name, created_at) VALUES (?1, CASE WHEN (SELECT count FROM registration_counter WHERE id = 1) <= ?2 THEN ?3 END, ?4)",
          ).bind(userId, REGISTRATIONS_PER_WINDOW, displayName, context.now),
          insert,
          ...recovery.statements,
        ]);
      } catch (error) {
        const paused = await full();
        if (paused !== undefined) throw registrationPaused(context, paused);
        throw error;
      }
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
      const { DB } = context.env;
      await limitByIp(context, context.env.RECOVERY_LIMITER);
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
          .bind(context.now, await sha256Hex(code))
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
