import { afterAll, beforeAll, expect, test } from "vitest";
import type { D1Database } from "./env";
import { startWorker } from "./test-harness";

let running: Awaited<ReturnType<typeof startWorker>>;
let db: D1Database;
let tombstones: D1Database;
beforeAll(async () => {
  // startWorker applies every migration to empty local databases.
  running = await startWorker({ dev: true });
  const env = await running.worker.getEnv();
  db = env.DB;
  tombstones = env.TOMBSTONES;
});
afterAll(() => running.close());

const tables = async (database: D1Database) =>
  (
    await database
      .prepare(
        "SELECT name FROM sqlite_schema WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name <> 'd1_migrations' ORDER BY name",
      )
      .all<{ name: string }>()
  ).results.map((row) => row.name);

const users = ["u-a", "u-b", "u-c"];
const seed = (user: string, other: string) => [
  db
    .prepare(
      "INSERT INTO credentials (id, user_id, public_key, sign_count, transports, label, created_at) VALUES (?, ?, x'00', 0, '[]', 'key', 1)",
    )
    .bind("cred-" + user, user),
  db
    .prepare("INSERT INTO recovery_codes (code_hash, user_id) VALUES (?, ?)")
    .bind("code-" + user, user),
  db
    .prepare(
      "INSERT INTO sessions (token_hash, user_id, kind, created_at, expires_at) VALUES (?, ?, 'normal', 1, 2)",
    )
    .bind("session-" + user, user),
  db
    .prepare(
      "INSERT INTO records (user_id, card_id, received_on, memo, updated_at) VALUES (?, '13-100-A001', '2026-11-10', 'memo', 1)",
    )
    .bind(user),
  db
    .prepare(
      "INSERT INTO invites (user_id, token_hash, expires_at) VALUES (?, ?, 2)",
    )
    .bind(user, "invite-" + user),
  db
    .prepare(
      "INSERT INTO rate_limits (user_id, kind, window_start, count) VALUES (?, 'friend-request', 1, 1)",
    )
    .bind(user),
  db
    .prepare(
      "INSERT INTO friend_requests (from_user_id, to_user_id, created_at) VALUES (?, ?, 1)",
    )
    .bind(user, other),
  db
    .prepare(
      "INSERT INTO blocks (blocker_id, blocked_id, created_at) VALUES (?, ?, 1)",
    )
    .bind(other, user),
];

test("creates every table of the account design", async () => {
  expect(await tables(db)).toEqual([
    "blocks",
    "challenges",
    "credentials",
    "friend_requests",
    "friendships",
    "invites",
    "rate_limits",
    "records",
    "records_write_events",
    "recovery_codes",
    "sessions",
    "users",
  ]);
  expect(await tables(tombstones)).toEqual(["tombstones"]);
});

test("removes every row of a deleted user and keeps the others", async () => {
  await db.batch([
    ...users.map((id) =>
      db
        .prepare(
          "INSERT INTO users (id, display_name, created_at) VALUES (?, ?, 1)",
        )
        .bind(id, id),
    ),
    ...seed("u-a", "u-b"),
    ...seed("u-c", "u-b"),
    db.prepare(
      "INSERT INTO friendships (user_a, user_b, created_at) VALUES ('u-a', 'u-b', 1)",
    ),
  ]);
  await db.prepare("DELETE FROM users WHERE id = 'u-a'").run();
  const count = async (sql: string, ...values: string[]) =>
    (await db
      .prepare(sql)
      .bind(...values)
      .first<{ n: number }>())!.n;
  for (const [table, columns] of [
    ["credentials", ["user_id"]],
    ["recovery_codes", ["user_id"]],
    ["sessions", ["user_id"]],
    ["records", ["user_id"]],
    ["invites", ["user_id"]],
    ["rate_limits", ["user_id"]],
    ["friend_requests", ["from_user_id", "to_user_id"]],
    ["friendships", ["user_a", "user_b"]],
    ["blocks", ["blocker_id", "blocked_id"]],
  ] as const) {
    const where = columns.map((column) => column + " = ?").join(" OR ");
    expect(
      await count(
        `SELECT count(*) AS n FROM ${table} WHERE ${where}`,
        ...columns.map(() => "u-a"),
      ),
    ).toBe(0);
  }
  expect(
    await count("SELECT count(*) AS n FROM records WHERE user_id = ?", "u-c"),
  ).toBe(1);
});

test.each([
  [
    "a friendship with the larger ID first",
    "INSERT INTO friendships (user_a, user_b, created_at) VALUES ('u-c', 'u-b', 1)",
  ],
  [
    "a request to oneself",
    "INSERT INTO friend_requests (from_user_id, to_user_id, created_at) VALUES ('u-b', 'u-b', 1)",
  ],
  [
    "a block of oneself",
    "INSERT INTO blocks (blocker_id, blocked_id, created_at) VALUES ('u-b', 'u-b', 1)",
  ],
  [
    "an unknown session kind",
    "INSERT INTO sessions (token_hash, user_id, kind, created_at, expires_at) VALUES ('x', 'u-b', 'admin', 1, 2)",
  ],
  [
    "a malformed receipt date",
    "INSERT INTO records (user_id, card_id, received_on, updated_at) VALUES ('u-b', 'c', '2026/11/10', 1)",
  ],
  [
    "a row for a missing user",
    "INSERT INTO records (user_id, card_id, updated_at) VALUES ('nobody', 'c', 1)",
  ],
])("rejects %s", async (_, sql) => {
  await expect(db.prepare(sql).run()).rejects.toThrow();
});
