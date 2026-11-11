import type { Context, Route } from "./app";
import { aliasesJson, currentRecords } from "./card-ids";
import { randomToken, sha256Hex } from "./encoding";
import { HttpError, json } from "./http";
import { field } from "./input";
import { limitFriendRequests, limitWrites } from "./rate-limit";
import { ME, readAsUser, requireSession } from "./session";
import { DAY } from "./time";
import { lastChanged, recordChange } from "./tombstones";

// AZ-3 and AZ-7; the write and daily request limits are in rate-limit.ts.
const INVITE_LIFETIME = 7 * DAY;
const MAX_FRIENDS = 200;
const MAX_RECEIVED = 100;
const tokenPattern = /^[A-Za-z0-9_-]{22}$/;

const ok = () => json({ ok: true });
const notFound = () => new HttpError(404, "not_found");

// friendships keeps one row per pair, smaller ID first.
const pair = (a: string, b: string) => (a < b ? [a, b] : [b, a]);

// Either direction between the two users, given as SQL expressions.
const blocked = (a: string, b: string) =>
  `EXISTS (SELECT 1 FROM blocks WHERE (blocker_id = ${a} AND blocked_id = ${b}) OR (blocker_id = ${b} AND blocked_id = ${a}))`;

// Every write is counted against the minute limit (AZ-7); reads go through
// readAsUser.
async function writer(context: Context) {
  const { userId } = await requireSession(context);
  await limitWrites(context, userId);
  return userId;
}

function tokenOf(body: unknown) {
  const token = field(body, "token");
  if (typeof token !== "string") throw new HttpError(400, "invalid_body");
  return token;
}

// Unknown, malformed, expired and replaced tokens all answer the same 404.
async function findInvite(context: Context, token: string) {
  const found = tokenPattern.test(token)
    ? await context.env.DB.prepare(
        "SELECT i.user_id, u.display_name FROM invites i JOIN users u ON u.id = i.user_id WHERE i.token_hash = ? AND i.expires_at > ?",
      )
        .bind(await sha256Hex(token), context.now)
        .first<{ user_id: string; display_name: string }>()
    : null;
  if (!found) throw new HttpError(404, "invite_not_found");
  return found;
}

// `a` and `b` in the order of `pair`.
const areFriends = async (context: Context, a: string, b: string) =>
  (await context.env.DB.prepare(
    "SELECT 1 FROM friendships WHERE user_a = ? AND user_b = ?",
  )
    .bind(a, b)
    .first()) !== null;

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
      `INSERT INTO friendships (user_a, user_b, created_at) SELECT ?1, ?2, ?3 WHERE EXISTS (SELECT 1 FROM friend_requests WHERE from_user_id = ?4 AND to_user_id = ?5) AND NOT ${blocked("?1", "?2")} AND ${friendCount("?1")} AND ${friendCount("?2")} ON CONFLICT DO NOTHING`,
    ).bind(a, b, context.now, other, me),
    DB.prepare(
      "DELETE FROM friend_requests WHERE ((from_user_id = ?1 AND to_user_id = ?2) OR (from_user_id = ?2 AND to_user_id = ?1)) AND EXISTS (SELECT 1 FROM friendships WHERE user_a = ?1 AND user_b = ?2)",
    ).bind(a, b),
  ]);
  return areFriends(context, a, b);
}

export const friendRoutes: Route[] = [
  {
    // Creates the link, or replaces it so the old one stops working.
    method: "POST",
    path: "/api/invite",
    handle: async (context) => {
      const me = await writer(context);
      const token = randomToken(16);
      const expiresAt = context.now + INVITE_LIFETIME;
      await context.env.DB.prepare(
        "INSERT INTO invites (user_id, token_hash, expires_at) VALUES (?, ?, ?) ON CONFLICT (user_id) DO UPDATE SET token_hash = excluded.token_hash, expires_at = excluded.expires_at",
      )
        .bind(me, await sha256Hex(token), expiresAt)
        .run();
      // The fragment never reaches a server or a Referer (AZ-3). The query
      // makes LINE open the default browser, where passkeys work.
      return json({
        url: `${context.env.ALLOWED_ORIGIN}/friends/invite?openExternalBrowser=1#t=${token}`,
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
    // The answer never tells whether the request was stored (AZ-5): blocks,
    // existing friendships and a full inbox all look like a plain request.
    method: "POST",
    path: "/api/friend-requests",
    handle: async (context) => {
      const me = await writer(context);
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
        `INSERT INTO friend_requests (from_user_id, to_user_id, created_at) SELECT ?1, ?2, ?3 WHERE NOT ${blocked("?1", "?2")} AND NOT EXISTS (SELECT 1 FROM friendships WHERE user_a = ?4 AND user_b = ?5) AND (SELECT count(*) FROM friend_requests WHERE to_user_id = ?2) < ${MAX_RECEIVED} ON CONFLICT DO NOTHING`,
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
      const me = await writer(context);
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
      const me = await writer(context);
      await context.env.DB.prepare(
        "DELETE FROM friend_requests WHERE from_user_id = ? AND to_user_id = ?",
      )
        .bind(context.params.userId, me)
        .run();
      return ok();
    },
  },
  {
    // Everything the friends page shows, in one round trip to D1. Counts by
    // current card number, as the records route does. Sent requests are not
    // listed (AZ-5).
    method: "GET",
    path: "/api/friends",
    handle: async (context) => {
      type Person = { id: string; display_name: string; created_at: number };
      const {
        rows: [friends, requests, blocks, [invite]],
      } = await readAsUser<
        [Person & { count: number }, Person, Person, { expires_at: number }]
      >(
        context,
        [
          `SELECT u.id, u.display_name, f.created_at, (SELECT count(DISTINCT coalesce(a.value, r.card_id)) FROM records r LEFT JOIN json_each(?3) a ON a.key = r.card_id WHERE r.user_id = u.id) AS count FROM friendships f JOIN users u ON u.id = CASE WHEN f.user_a = ${ME} THEN f.user_b ELSE f.user_a END WHERE (f.user_a = ${ME} OR f.user_b = ${ME}) AND NOT ${blocked(ME, "u.id")} ORDER BY f.created_at DESC, u.id`,
          aliasesJson,
        ],
        [
          `SELECT u.id, u.display_name, r.created_at FROM friend_requests r JOIN users u ON u.id = r.from_user_id WHERE r.to_user_id = ${ME} ORDER BY r.created_at DESC, u.id`,
        ],
        [
          `SELECT u.id, u.display_name, b.created_at FROM blocks b JOIN users u ON u.id = b.blocked_id WHERE b.blocker_id = ${ME} ORDER BY b.created_at DESC, u.id`,
        ],
        [
          `SELECT expires_at FROM invites WHERE user_id = ${ME} AND expires_at > ?2`,
        ],
      );
      return json({
        friends: friends.map((row) => ({
          userId: row.id,
          displayName: row.display_name,
          count: row.count,
          since: row.created_at,
        })),
        requests: requests.map((row) => ({
          userId: row.id,
          displayName: row.display_name,
          requestedAt: row.created_at,
        })),
        blocks: blocks.map((row) => ({
          userId: row.id,
          displayName: row.display_name,
          blockedAt: row.created_at,
        })),
        invite: { expiresAt: invite?.expires_at ?? null },
      });
    },
  },
  {
    // The only route that returns another person's records (AZ-1): one query
    // checks the friendship and both blocks, and never reads the memo.
    method: "GET",
    path: "/api/friends/:userId/records",
    handle: async (context) => {
      const {
        rows: [results],
      } = await readAsUser<
        [
          {
            display_name: string;
            card_id: string | null;
            received_on: string | null;
          },
        ]
      >(context, [
        `SELECT u.display_name, r.card_id, r.received_on FROM users u JOIN friendships f ON (f.user_a = ${ME} AND f.user_b = u.id) OR (f.user_a = u.id AND f.user_b = ${ME}) LEFT JOIN records r ON r.user_id = u.id WHERE u.id = ?3 AND NOT ${blocked(ME, "u.id")}`,
        context.params.userId,
      ]);
      if (!results.length) throw notFound();
      const records = currentRecords(
        results.flatMap(({ card_id, received_on }) =>
          card_id === null
            ? []
            : [{ cardId: card_id, receivedOn: received_on }],
        ),
      );
      return json({
        displayName: results[0]!.display_name,
        count: records.length,
        records,
      });
    },
  },
  {
    method: "DELETE",
    path: "/api/friends/:userId",
    handle: async (context) => {
      const me = await writer(context);
      const other = context.params.userId!;
      const [a, b] = pair(me, other);
      const { DB } = context.env;
      if (await areFriends(context, a, b)) {
        // IDs only, so a Time Travel restore cannot undo it (PR-6).
        await recordChange(context, "friendship", me, other, async (mark) =>
          lastChanged(
            await DB.batch([
              ...mark(
                "EXISTS (SELECT 1 FROM friendships WHERE user_a = ? AND user_b = ?)",
                a,
                b,
              ),
              DB.prepare(
                "DELETE FROM friendships WHERE user_a = ? AND user_b = ? RETURNING user_a",
              ).bind(a, b),
            ]),
          ),
        );
      }
      return ok();
    },
  },
  {
    // Ends the friendship and pending requests both ways without telling the
    // other side; unknown IDs answer the same so IDs cannot be probed (AZ-2).
    method: "PUT",
    path: "/api/blocks/:userId",
    handle: async (context) => {
      const me = await writer(context);
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
      const me = await writer(context);
      await context.env.DB.prepare(
        "DELETE FROM blocks WHERE blocker_id = ? AND blocked_id = ?",
      )
        .bind(me, context.params.userId)
        .run();
      return ok();
    },
  },
];
