import type { Context, Route } from "./app";
import { aliasesJson, currentRecords } from "./card-ids";
import { HttpError, json } from "./http";
import { limitFriendRequests, limitWrites } from "./rate-limit";
import { base64url, hash, requireSession } from "./session";
import { recordChange } from "./tombstones";

const DAY = 24 * 60 * 60 * 1000;
// AZ-3 and AZ-7; the write and daily request limits are in rate-limit.ts.
const INVITE_LIFETIME = 7 * DAY;
const MAX_FRIENDS = 200;
const MAX_RECEIVED = 100;
const tokenPattern = /^[A-Za-z0-9_-]{22}$/;

const ok = () => json({ ok: true });
const notFound = () => new HttpError(404, "not_found");

// friendships keeps one row per pair, smaller ID first.
const pair = (a: string, b: string) => (a < b ? [a, b] : [b, a]);

// Either direction; ?1 and ?2 are the two users.
const blockedSql =
  "EXISTS (SELECT 1 FROM blocks WHERE (blocker_id = ?1 AND blocked_id = ?2) OR (blocker_id = ?2 AND blocked_id = ?1))";

async function signedIn(context: Context, { write = false } = {}) {
  const { userId } = await requireSession(context);
  if (write) await limitWrites(context, userId);
  return userId;
}

function tokenOf(body: unknown) {
  const token =
    typeof body === "object" && body !== null && !Array.isArray(body)
      ? (body as { token?: unknown }).token
      : undefined;
  if (typeof token !== "string") throw new HttpError(400, "invalid_body");
  return token;
}

// Unknown, malformed, expired and replaced tokens all answer the same 404.
async function findInvite(context: Context, token: string) {
  const found = tokenPattern.test(token)
    ? await context.env.DB.prepare(
        "SELECT i.user_id, u.display_name FROM invites i JOIN users u ON u.id = i.user_id WHERE i.token_hash = ? AND i.expires_at > ?",
      )
        .bind(await hash(token), context.now)
        .first<{ user_id: string; display_name: string }>()
    : null;
  if (!found) throw new HttpError(404, "invite_not_found");
  return found;
}

const received = async (context: Context, me: string, other: string) =>
  (await context.env.DB.prepare(
    "SELECT 1 FROM friend_requests WHERE from_user_id = ? AND to_user_id = ?",
  )
    .bind(other, me)
    .first()) !== null;

// Turns the received request from `other` into a friendship when neither is
// full; false leaves the request as it was.
async function accept(context: Context, me: string, other: string) {
  const { DB } = context.env;
  const [a, b] = pair(me, other);
  const friendCount = (user: string) =>
    `(SELECT count(*) FROM friendships WHERE user_a = ${user} OR user_b = ${user}) < ${MAX_FRIENDS}`;
  await DB.batch([
    DB.prepare(
      `INSERT INTO friendships (user_a, user_b, created_at) SELECT ?1, ?2, ?3 WHERE EXISTS (SELECT 1 FROM friend_requests WHERE from_user_id = ?4 AND to_user_id = ?5) AND NOT ${blockedSql} AND ${friendCount("?1")} AND ${friendCount("?2")} ON CONFLICT DO NOTHING`,
    ).bind(a, b, context.now, other, me),
    DB.prepare(
      "DELETE FROM friend_requests WHERE ((from_user_id = ?1 AND to_user_id = ?2) OR (from_user_id = ?2 AND to_user_id = ?1)) AND EXISTS (SELECT 1 FROM friendships WHERE user_a = ?1 AND user_b = ?2)",
    ).bind(a, b),
  ]);
  return (
    (await DB.prepare(
      "SELECT 1 FROM friendships WHERE user_a = ? AND user_b = ?",
    )
      .bind(a, b)
      .first()) !== null
  );
}

export const friendRoutes: Route[] = [
  {
    method: "GET",
    path: "/api/invite",
    handle: async (context) => {
      const me = await signedIn(context);
      const row = await context.env.DB.prepare(
        "SELECT expires_at FROM invites WHERE user_id = ? AND expires_at > ?",
      )
        .bind(me, context.now)
        .first<{ expires_at: number }>();
      return json({ expiresAt: row?.expires_at ?? null });
    },
  },
  {
    // Creates the link, or replaces it so the old one stops working.
    method: "POST",
    path: "/api/invite",
    handle: async (context) => {
      const me = await signedIn(context, { write: true });
      const token = base64url(crypto.getRandomValues(new Uint8Array(16)));
      const expiresAt = context.now + INVITE_LIFETIME;
      await context.env.DB.prepare(
        "INSERT INTO invites (user_id, token_hash, expires_at) VALUES (?, ?, ?) ON CONFLICT (user_id) DO UPDATE SET token_hash = excluded.token_hash, expires_at = excluded.expires_at",
      )
        .bind(me, await hash(token), expiresAt)
        .run();
      // The fragment never reaches a server or a Referer (AZ-3).
      return json({
        url: `${context.env.ALLOWED_ORIGIN}/friends/invite#t=${token}`,
        expiresAt,
      });
    },
  },
  {
    // Open to visitors who are not signed in, and ignores blocks so the
    // blocked side cannot tell (AZ-4, AZ-5).
    method: "POST",
    path: "/api/invite/lookup",
    handle: async (context) => {
      const token = tokenOf(context.body);
      const session = await requireSession(context).catch((error: unknown) => {
        if (error instanceof HttpError) return null;
        throw error;
      });
      const invite = await findInvite(context, token);
      return json({
        displayName: invite.display_name,
        ...(session?.userId === invite.user_id && { self: true }),
      });
    },
  },
  {
    method: "GET",
    path: "/api/friend-requests",
    handle: async (context) => {
      const me = await signedIn(context);
      const { results } = await context.env.DB.prepare(
        "SELECT u.id, u.display_name, r.created_at FROM friend_requests r JOIN users u ON u.id = r.from_user_id WHERE r.to_user_id = ? ORDER BY r.created_at DESC, u.id",
      )
        .bind(me)
        .all<{ id: string; display_name: string; created_at: number }>();
      return json({
        requests: results.map((row) => ({
          userId: row.id,
          displayName: row.display_name,
          requestedAt: row.created_at,
        })),
      });
    },
  },
  {
    // The answer never tells whether the request was stored (AZ-5): blocks,
    // existing friendships and a full inbox all look like a plain request.
    method: "POST",
    path: "/api/friend-requests",
    handle: async (context) => {
      const me = await signedIn(context, { write: true });
      await limitFriendRequests(context, me);
      const { user_id: other } = await findInvite(
        context,
        tokenOf(context.body),
      );
      if (other === me) throw new HttpError(400, "self_request");
      // Both asked: the same as accepting the other's request.
      if (
        (await received(context, me, other)) &&
        (await accept(context, me, other))
      )
        return ok();
      const [a, b] = pair(me, other);
      await context.env.DB.prepare(
        `INSERT INTO friend_requests (from_user_id, to_user_id, created_at) SELECT ?1, ?2, ?3 WHERE NOT ${blockedSql} AND NOT EXISTS (SELECT 1 FROM friendships WHERE user_a = ?4 AND user_b = ?5) AND (SELECT count(*) FROM friend_requests WHERE to_user_id = ?2) < ${MAX_RECEIVED} ON CONFLICT DO NOTHING`,
      )
        .bind(me, other, context.now, a, b)
        .run();
      return ok();
    },
  },
  {
    method: "POST",
    path: "/api/friend-requests/:userId/accept",
    handle: async (context) => {
      const me = await signedIn(context, { write: true });
      const other = context.params.userId!;
      if (!(await received(context, me, other))) throw notFound();
      if (!(await accept(context, me, other)))
        throw new HttpError(409, "friend_limit");
      return ok();
    },
  },
  {
    // Declines a received request; a sent one cannot be seen or withdrawn.
    method: "DELETE",
    path: "/api/friend-requests/:userId",
    handle: async (context) => {
      const me = await signedIn(context, { write: true });
      await context.env.DB.prepare(
        "DELETE FROM friend_requests WHERE from_user_id = ? AND to_user_id = ?",
      )
        .bind(context.params.userId, me)
        .run();
      return ok();
    },
  },
  {
    // Counts by current card number, as the records route does.
    method: "GET",
    path: "/api/friends",
    handle: async (context) => {
      const me = await signedIn(context);
      const { results } = await context.env.DB.prepare(
        `SELECT u.id, u.display_name, f.created_at, (SELECT count(DISTINCT coalesce(a.value, r.card_id)) FROM records r LEFT JOIN json_each(?2) a ON a.key = r.card_id WHERE r.user_id = u.id) AS count FROM friendships f JOIN users u ON u.id = CASE WHEN f.user_a = ?1 THEN f.user_b ELSE f.user_a END WHERE (f.user_a = ?1 OR f.user_b = ?1) AND NOT ${blockedSql.replaceAll("?2", "u.id")} ORDER BY f.created_at DESC, u.id`,
      )
        .bind(me, aliasesJson)
        .all<{
          id: string;
          display_name: string;
          created_at: number;
          count: number;
        }>();
      return json({
        friends: results.map((row) => ({
          userId: row.id,
          displayName: row.display_name,
          count: row.count,
          since: row.created_at,
        })),
      });
    },
  },
  {
    // The only route that returns another person's records (AZ-1): one query
    // checks the friendship and both blocks, and never reads the memo.
    method: "GET",
    path: "/api/friends/:userId/records",
    handle: async (context) => {
      const me = await signedIn(context);
      const other = context.params.userId!;
      const [a, b] = pair(me, other);
      const { results } = await context.env.DB.prepare(
        `SELECT r.card_id, r.received_on FROM users u JOIN friendships f ON f.user_a = ?3 AND f.user_b = ?4 LEFT JOIN records r ON r.user_id = u.id WHERE u.id = ?2 AND NOT ${blockedSql}`,
      )
        .bind(me, other, a, b)
        .all<{ card_id: string | null; received_on: string | null }>();
      if (!results.length) throw notFound();
      const records = currentRecords(
        results.flatMap(({ card_id, received_on }) =>
          card_id === null
            ? []
            : [{ cardId: card_id, receivedOn: received_on }],
        ),
      );
      return json({ count: records.length, records });
    },
  },
  {
    method: "DELETE",
    path: "/api/friends/:userId",
    handle: async (context) => {
      const me = await signedIn(context, { write: true });
      const other = context.params.userId!;
      const [a, b] = pair(me, other);
      const { DB } = context.env;
      const exists = await DB.prepare(
        "SELECT 1 FROM friendships WHERE user_a = ? AND user_b = ?",
      )
        .bind(a, b)
        .first();
      if (exists) {
        // IDs only, so a Time Travel restore cannot undo it (PR-6).
        await recordChange(context, "friendship", me, other, async (mark) => {
          const results = (await DB.batch([
            ...mark(
              "EXISTS (SELECT 1 FROM friendships WHERE user_a = ? AND user_b = ?)",
              a,
              b,
            ),
            DB.prepare(
              "DELETE FROM friendships WHERE user_a = ? AND user_b = ? RETURNING user_a",
            ).bind(a, b),
          ])) as { results: unknown[] }[];
          return results.at(-1)!.results.length ? true : undefined;
        });
      }
      return ok();
    },
  },
  {
    method: "GET",
    path: "/api/blocks",
    handle: async (context) => {
      const me = await signedIn(context);
      const { results } = await context.env.DB.prepare(
        "SELECT u.id, u.display_name, b.created_at FROM blocks b JOIN users u ON u.id = b.blocked_id WHERE b.blocker_id = ? ORDER BY b.created_at DESC, u.id",
      )
        .bind(me)
        .all<{ id: string; display_name: string; created_at: number }>();
      return json({
        blocks: results.map((row) => ({
          userId: row.id,
          displayName: row.display_name,
          blockedAt: row.created_at,
        })),
      });
    },
  },
  {
    // Ends the friendship and pending requests both ways without telling the
    // other side; unknown IDs answer the same so IDs cannot be probed (AZ-2).
    method: "PUT",
    path: "/api/blocks/:userId",
    handle: async (context) => {
      const me = await signedIn(context, { write: true });
      const other = context.params.userId!;
      if (other === me) throw new HttpError(400, "self_block");
      const { DB } = context.env;
      const target = await DB.prepare(
        "SELECT EXISTS (SELECT 1 FROM blocks WHERE blocker_id = ?1 AND blocked_id = ?2) AS blocked FROM users WHERE id = ?2",
      )
        .bind(me, other)
        .first<{ blocked: number }>();
      if (!target || target.blocked) return ok();
      const [a, b] = pair(me, other);
      await recordChange(context, "block", me, other, (mark) =>
        DB.batch([
          ...mark(),
          DB.prepare(
            "DELETE FROM friendships WHERE user_a = ? AND user_b = ?",
          ).bind(a, b),
          DB.prepare(
            "DELETE FROM friend_requests WHERE (from_user_id = ?1 AND to_user_id = ?2) OR (from_user_id = ?2 AND to_user_id = ?1)",
          ).bind(me, other),
          DB.prepare(
            // A concurrent block of the same user may have just inserted it.
            "INSERT INTO blocks (blocker_id, blocked_id, created_at) VALUES (?, ?, ?) ON CONFLICT (blocker_id, blocked_id) DO NOTHING",
          ).bind(me, other, context.now),
        ]),
      );
      return ok();
    },
  },
  {
    // The friendship does not come back; a new request starts over.
    method: "DELETE",
    path: "/api/blocks/:userId",
    handle: async (context) => {
      const me = await signedIn(context, { write: true });
      await context.env.DB.prepare(
        "DELETE FROM blocks WHERE blocker_id = ? AND blocked_id = ?",
      )
        .bind(me, context.params.userId)
        .run();
      return ok();
    },
  },
];
