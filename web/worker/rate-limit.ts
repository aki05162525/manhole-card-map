import type { Context } from "./app";
import { HttpError } from "./http";

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;
// Japanese calendar days start at 15:00 UTC.
const JST = 9 * 60 * MINUTE;

// AZ-7. Fixed windows: one row per user and kind holds the current one.
const limits = {
  write: { max: 60, window: MINUTE, offset: 0 },
  "friend-request": { max: 20, window: DAY, offset: JST },
};

export async function limit(
  context: Context,
  userId: string,
  kind: keyof typeof limits,
) {
  const { max, window, offset } = limits[kind];
  const start = Math.floor((context.now + offset) / window) * window - offset;
  const row = await context.env.DB.prepare(
    "INSERT INTO rate_limits (user_id, kind, window_start, count) VALUES (?, ?, ?, 1) ON CONFLICT (user_id, kind) DO UPDATE SET count = CASE WHEN window_start = excluded.window_start THEN count + 1 ELSE 1 END, window_start = excluded.window_start RETURNING count",
  )
    .bind(userId, kind, start)
    .first<{ count: number }>();
  if (row!.count > max)
    throw new HttpError(429, "rate_limited", {
      "Retry-After": String(Math.ceil((start + window - context.now) / 1000)),
    });
}
