import type { Context } from "./app";
import { HttpError } from "./http";

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;
// Japanese calendar days start at 15:00 UTC.
const JST = 9 * 60 * MINUTE;

// AZ-7: one rolling-minute quota of 60 for every write a user makes, records
// and friends alike. The table keeps its receipt-era name (migration 0002).
// An atomic conditional INSERT enforces it across Worker instances; at most
// 60 events per user survive, and deletion cascades.
export async function limitWrites(context: Context, user: string) {
  const db = context.env.DB;
  await db
    .prepare(
      "DELETE FROM records_write_events WHERE user_id = ? AND written_at <= ?",
    )
    .bind(user, context.now - MINUTE)
    .run();
  const accepted = await db
    .prepare(
      "INSERT INTO records_write_events (id, user_id, written_at) SELECT ?, ?, ? WHERE (SELECT count(*) FROM records_write_events WHERE user_id = ? AND written_at > ?) < 60 RETURNING id",
    )
    .bind(crypto.randomUUID(), user, context.now, user, context.now - MINUTE)
    .first();
  if (!accepted)
    throw new HttpError(429, "rate_limited", { "Retry-After": "60" });
}

// AZ-7: 20 friend requests per Japanese calendar day. One counter row per
// user holds the latest day; a new day resets it, while a late request from
// an earlier day counts against the latest one instead of rolling it back.
export async function limitFriendRequests(context: Context, user: string) {
  const start = Math.floor((context.now + JST) / DAY) * DAY - JST;
  const row = await context.env.DB.prepare(
    "INSERT INTO rate_limits (user_id, kind, window_start, count) VALUES (?, 'friend-request', ?, 1) ON CONFLICT (user_id, kind) DO UPDATE SET count = CASE WHEN excluded.window_start > window_start THEN 1 ELSE count + 1 END, window_start = max(window_start, excluded.window_start) RETURNING count",
  )
    .bind(user, start)
    .first<{ count: number }>();
  if (row!.count > 20)
    throw new HttpError(429, "rate_limited", {
      "Retry-After": String(Math.ceil((start + DAY - context.now) / 1000)),
    });
}
