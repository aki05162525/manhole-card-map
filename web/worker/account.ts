import type { Context, Route } from "./app";
import { credentialsOf, insertCredential, profile } from "./auth";
import { HttpError, json } from "./http";
import { field, readDisplayName, readName } from "./input";
import { replaceCodes } from "./recovery-codes";
import {
  endSession,
  promoteRecovery,
  requireRecentAuth,
  requireSession,
} from "./session";
import { recordChange } from "./tombstones";
import { registrationOptions, verifyRegistration } from "./webauthn";

const createdAt = async (context: Context, userId: string) =>
  (await context.env.DB.prepare("SELECT created_at FROM users WHERE id = ?")
    .bind(userId)
    .first<{ created_at: number }>())!.created_at;

export const accountRoutes: Route[] = [
  {
    method: "GET",
    path: "/api/me",
    handle: async (context) => {
      const { userId } = await requireSession(context);
      return json(await profile(context, userId));
    },
  },
  {
    method: "PATCH",
    path: "/api/me",
    handle: async (context) => {
      const { userId } = await requireSession(context);
      const displayName = readDisplayName(field(context.body, "displayName"));
      await context.env.DB.prepare(
        "UPDATE users SET display_name = ? WHERE id = ?",
      )
        .bind(displayName, userId)
        .run();
      return json(await profile(context, userId));
    },
  },
  {
    method: "DELETE",
    path: "/api/me",
    // One batch removes every row of the user, both sides of a relation
    // included, without relying on ON DELETE CASCADE alone (PR-4).
    handle: async (context) => {
      const { userId } = await requireRecentAuth(context);
      const { DB } = context.env;
      const statements = [
        ["sessions", "user_id"],
        ["credentials", "user_id"],
        ["recovery_codes", "user_id"],
        ["records", "user_id"],
        ["records_write_events", "user_id"],
        ["rate_limits", "user_id"],
        ["invites", "user_id"],
        ["friend_requests", "from_user_id", "to_user_id"],
        ["friendships", "user_a", "user_b"],
        ["blocks", "blocker_id", "blocked_id"],
        ["users", "id"],
      ].map(([table, ...columns]) =>
        DB.prepare(
          `DELETE FROM ${table} WHERE ${columns.map((column) => column + " = ?1").join(" OR ")}`,
        ).bind(userId),
      );
      await recordChange(context, "account", userId, null, (mark) =>
        DB.batch([...mark(), ...statements]),
      );
      await endSession(context);
      return json({ ok: true });
    },
  },
  {
    method: "GET",
    path: "/api/passkeys",
    handle: async (context) => {
      const { userId } = await requireSession(context);
      const { results } = await context.env.DB.prepare(
        "SELECT id, label, created_at, last_used_at FROM credentials WHERE user_id = ? ORDER BY created_at, rowid",
      )
        .bind(userId)
        .all<{
          id: string;
          label: string;
          created_at: number;
          last_used_at: number | null;
        }>();
      return json({
        passkeys: results.map((row) => ({
          id: row.id,
          label: row.label,
          createdAt: row.created_at,
          lastUsedAt: row.last_used_at,
        })),
      });
    },
  },
  // The only routes a recovery session may use (AU-9).
  {
    method: "POST",
    path: "/api/passkeys/register/options",
    handle: async (context) => {
      const { userId, kind } = await requireSession(context, {
        allowRecovery: true,
      });
      const credentials = await credentialsOf(context, userId);
      if (credentials.length >= 10 && kind !== "recovery")
        throw new HttpError(409, "passkey_limit");
      return json(
        await registrationOptions(context, "passkey", {
          id: userId,
          createdAt: await createdAt(context, userId),
          credentials,
        }),
      );
    },
  },
  {
    method: "POST",
    path: "/api/passkeys/register/verify",
    body: "webauthn",
    handle: async (context) => {
      const session = await requireSession(context, { allowRecovery: true });
      const { userId, credential, spend } = await verifyRegistration(
        context,
        field(context.body, "response"),
        "passkey",
      );
      if (userId !== session.userId)
        throw new HttpError(400, "invalid_credential");
      const recovering = session.kind === "recovery";
      const insert = await insertCredential(context, userId, credential, {
        limit: !recovering,
      });
      await spend();
      // After recovery the new passkey counts as the latest verification,
      // so a leaked passkey can be removed right away (AU-11).
      if (recovering) await promoteRecovery(context, session, [insert]);
      else if (!(await insert.first()))
        throw new HttpError(409, "passkey_limit");
      return json(await profile(context, userId));
    },
  },
  {
    method: "PATCH",
    path: "/api/passkeys/:id",
    handle: async (context) => {
      const { userId } = await requireSession(context);
      const label = readName(field(context.body, "label"), 30, "invalid_label");
      const updated = await context.env.DB.prepare(
        "UPDATE credentials SET label = ? WHERE id = ? AND user_id = ? RETURNING id",
      )
        .bind(label, context.params.id, userId)
        .first();
      if (!updated) throw new HttpError(404, "not_found");
      return json({ ok: true });
    },
  },
  {
    method: "DELETE",
    path: "/api/passkeys/:id",
    handle: async (context) => {
      const { userId } = await requireRecentAuth(context);
      const id = context.params.id!;
      const { DB } = context.env;
      const owned = await DB.prepare(
        "SELECT (SELECT count(*) FROM credentials WHERE user_id = ?1) AS total FROM credentials WHERE id = ?2 AND user_id = ?1",
      )
        .bind(userId, id)
        .first<{ total: number }>();
      if (!owned) throw new HttpError(404, "not_found");
      if (owned.total <= 1) throw new HttpError(409, "last_passkey");
      // Lost to a concurrent deletion when nothing comes back: the record
      // is dropped so a replay never removes the passkey that remains. The
      // mark uses the same condition as the DELETE, in the same batch.
      const deletable =
        "id = ? AND user_id = ? AND (SELECT count(*) FROM credentials WHERE user_id = ?) > 1";
      const deleted = await recordChange(
        context,
        "credential",
        id,
        null,
        async (mark) => {
          const results = (await DB.batch([
            ...mark(
              `EXISTS (SELECT 1 FROM credentials WHERE ${deletable})`,
              id,
              userId,
              userId,
            ),
            DB.prepare(
              `DELETE FROM credentials WHERE ${deletable} RETURNING id`,
            ).bind(id, userId, userId),
          ])) as { results: unknown[] }[];
          return results.at(-1)!.results.length ? true : undefined;
        },
      );
      if (!deleted) throw new HttpError(409, "last_passkey");
      return json({ ok: true });
    },
  },
  {
    method: "GET",
    path: "/api/recovery-codes",
    handle: async (context) => {
      const { userId } = await requireSession(context);
      return json({
        remaining: (await profile(context, userId)).recoveryCodesRemaining,
      });
    },
  },
  {
    method: "POST",
    path: "/api/recovery-codes",
    handle: async (context) => {
      const { userId } = await requireRecentAuth(context);
      const { codes, statements } = await replaceCodes(context.env.DB, userId);
      await context.env.DB.batch(statements);
      return json({ recoveryCodes: codes });
    },
  },
];
