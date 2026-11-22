import type {
  FriendReceipts,
  FriendsPage,
  Invite,
  InviteLookup,
} from "../src/contract/private-api";
import type { Context, Route } from "./app";
import { aliasesJson, currentRecords } from "./card-ids";
import { randomToken } from "./encoding";
import { HttpError, json } from "./http";
import { field } from "./input";
import { limitFriendRequests, limitWrites } from "./rate-limit";
import { columns, first, rows } from "./rows";
import { sealColumns, sealOf, sealSql } from "./seal";
import { ME, readAsUser, requireSession } from "./session";
import { lastChanged, recordChange } from "./tombstones";

// AZ-7; the write and daily request limits are in rate-limit.ts.
const MAX_FRIENDS = 200;
const MAX_RECEIVED = 100;
const tokenPattern = /^[A-Za-z0-9_-]{22}$/;

const ok = () => json({ ok: true });
const notFound = () => new HttpError("not_found");

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
  if (typeof token !== "string") throw new HttpError("invalid_body");
  return token;
}

// AZ-3: 128 bits. The token is kept as it is, so the page can show the link
// again; it only lets its holder ask, and the owner still has to accept.
const inviteToken = () => randomToken(16);
// The fragment never reaches a server or a Referer (AZ-3). The query makes
// LINE open the default browser, where passkeys work.
const inviteUrl = (context: Context, token: string) =>
  `${context.env.ALLOWED_ORIGIN}/friends/invite?openExternalBrowser=1#t=${token}`;

// Unknown, malformed and replaced tokens all answer the same 404.
async function findInvite(context: Context, token: string) {
  const found = tokenPattern.test(token)
    ? await first(
        context.env.DB.prepare(
          `SELECT i.user_id, u.display_name, ${sealSql("u")} FROM invites i JOIN users u ON u.id = i.user_id WHERE i.token = ?`,
        ).bind(token),
        columns({ user_id: "text", display_name: "text", ...sealColumns }),
      )
    : null;
  if (!found) throw new HttpError("invite_not_found");
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

// Selected as `u.id, u.display_name, <the row's>.created_at`.
const personRow = columns({
  id: "text",
  display_name: "text",
  ...sealColumns,
  created_at: "integer",
});
const friendRow = columns({
  id: "text",
  display_name: "text",
  ...sealColumns,
  created_at: "integer",
  count: "integer",
});

export const friendRoutes: Route[] = [
  {
    // Replaces the link, so the old one stops working.
    method: "POST",
    path: "/api/invite",
    handle: async (context) => {
      const me = await writer(context);
      const token = inviteToken();
      await context.env.DB.prepare(
        "INSERT INTO invites (user_id, token) VALUES (?, ?) ON CONFLICT (user_id) DO UPDATE SET token = excluded.token",
      )
        .bind(me, token)
        .run();
      return json({ url: inviteUrl(context, token) } satisfies Invite);
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
        ...sealOf(invite),
        ...(session?.userId === invite.user_id && { self: true as const }),
      } satisfies InviteLookup);
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
      if (other === me) throw new HttpError("self_request");
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
      const other = context.params.userId;
      if (!(await received(context, me, other))) throw notFound();
      if (!(await accept(context, me, other)))
        throw new HttpError("friend_limit");
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
    // listed (AZ-5). The first read also makes the user's invite link, so
    // the page never has to ask for one before showing it.
    method: "GET",
    path: "/api/friends",
    handle: async (context) => {
      const {
        results: [friends, requests, blocks, , invites],
      } = await readAsUser(
        context,
        [
          `SELECT u.id, u.display_name, ${sealSql("u")}, f.created_at, (SELECT count(DISTINCT coalesce(a.value, r.card_id)) FROM records r LEFT JOIN json_each(?3) a ON a.key = r.card_id WHERE r.user_id = u.id) AS count FROM friendships f JOIN users u ON u.id = CASE WHEN f.user_a = ${ME} THEN f.user_b ELSE f.user_a END WHERE (f.user_a = ${ME} OR f.user_b = ${ME}) AND NOT ${blocked(ME, "u.id")} ORDER BY f.created_at DESC, u.id`,
          aliasesJson,
        ],
        [
          `SELECT u.id, u.display_name, ${sealSql("u")}, r.created_at FROM friend_requests r JOIN users u ON u.id = r.from_user_id WHERE r.to_user_id = ${ME} ORDER BY r.created_at DESC, u.id`,
        ],
        [
          `SELECT u.id, u.display_name, ${sealSql("u")}, b.created_at FROM blocks b JOIN users u ON u.id = b.blocked_id WHERE b.blocker_id = ${ME} ORDER BY b.created_at DESC, u.id`,
        ],
        [
          `INSERT INTO invites (user_id, token) SELECT ${ME}, ?3 WHERE ${ME} IS NOT NULL ON CONFLICT (user_id) DO NOTHING`,
          inviteToken(),
        ],
        [`SELECT token FROM invites WHERE user_id = ${ME}`],
      );
      const [invite] = rows(columns({ token: "text" }), invites);
      return json({
        friends: rows(friendRow, friends).map((row) => ({
          userId: row.id,
          displayName: row.display_name,
          ...sealOf(row),
          count: row.count,
          since: row.created_at,
        })),
        requests: rows(personRow, requests).map((row) => ({
          userId: row.id,
          displayName: row.display_name,
          ...sealOf(row),
          requestedAt: row.created_at,
        })),
        blocks: rows(personRow, blocks).map((row) => ({
          userId: row.id,
          displayName: row.display_name,
          ...sealOf(row),
          blockedAt: row.created_at,
        })),
        invite: { url: inviteUrl(context, invite.token) },
      } satisfies FriendsPage);
    },
  },
  {
    // The only route that returns another person's records (AZ-1): one query
    // checks the friendship and both blocks, and never reads the memo.
    method: "GET",
    path: "/api/friends/:userId/records",
    handle: async (context) => {
      const {
        results: [found],
      } = await readAsUser(context, [
        `SELECT u.display_name, ${sealSql("u")}, r.card_id, r.received_on FROM users u JOIN friendships f ON (f.user_a = ${ME} AND f.user_b = u.id) OR (f.user_a = u.id AND f.user_b = ${ME}) LEFT JOIN records r ON r.user_id = u.id WHERE u.id = ?3 AND NOT ${blocked(ME, "u.id")}`,
        context.params.userId,
      ]);
      const results = rows(
        columns({
          display_name: "text",
          ...sealColumns,
          card_id: "text?",
          received_on: "text?",
        }),
        found,
      );
      if (!results.length) throw notFound();
      const records = currentRecords(
        results.flatMap(({ card_id, received_on }) =>
          card_id === null
            ? []
            : [{ cardId: card_id, receivedOn: received_on }],
        ),
      );
      return json({
        displayName: results[0].display_name,
        ...sealOf(results[0]),
        count: records.length,
        records,
      } satisfies FriendReceipts);
    },
  },
  {
    method: "DELETE",
    path: "/api/friends/:userId",
    handle: async (context) => {
      const me = await writer(context);
      const other = context.params.userId;
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
      const other = context.params.userId;
      if (other === me) throw new HttpError("self_block");
      const { DB } = context.env;
      const target = await first(
        DB.prepare(
          "SELECT EXISTS (SELECT 1 FROM blocks WHERE blocker_id = ?1 AND blocked_id = ?2) AS blocked FROM users WHERE id = ?2",
        ).bind(me, other),
        columns({ blocked: "integer" }),
      );
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
