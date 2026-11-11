import { createHash } from "node:crypto";
import { afterAll, beforeAll, beforeEach, expect, test, vi } from "vitest";
import { createApp, type Route } from "./app";
import type { D1Database, Env } from "./env";
import { json } from "./http";
import { routes } from "./routes";
import { createSession } from "./session";
import { countCalls, startWorker } from "./test-harness";

// The friend views count a card under its current number (DA-2).
vi.mock("../../data/card-ids.json", () => ({
  default: {
    ids: ["01-100-A001", "13-100-A001", "13-100-OLD"],
    aliases: { "13-100-OLD": "13-100-A001" },
    excluded: {},
  },
}));

const origin = "https://manhole-techo.com";
const DAY = 24 * 60 * 60 * 1000;
// Test-only: the auth API is built separately, so sessions are made here.
const login: Route = {
  method: "POST",
  path: "/api/test/login",
  handle: async (context) => {
    const { user, kind } = context.body as {
      user: string;
      kind: "normal" | "recovery";
    };
    await createSession(context, user, kind);
    return json({ ok: true });
  },
};

let running: Awaited<ReturnType<typeof startWorker>>;
let env: Env;
let db: D1Database;
let tombstones: D1Database;
let now = 0;
const logs: string[] = [];
const app = createApp({
  routes: [...routes, login],
  clock: () => now,
  log: (line) => logs.push(line),
});
beforeAll(async () => {
  running = await startWorker({ dev: true });
  env = {
    ...(await running.worker.getEnv()),
    ALLOWED_ORIGIN: origin,
    RP_ID: "manhole-techo.com",
  };
  db = env.DB!;
  tombstones = env.TOMBSTONES!;
});
afterAll(() => running.close());

const tables = [
  "sessions",
  "records",
  "invites",
  "friend_requests",
  "friendships",
  "blocks",
  "rate_limits",
  "records_write_events",
  "users",
];
const names = {
  alice: "アリス",
  bob: "ボブ",
  carol: "キャロル",
  dave: "デイブ",
} as const;
type Name = keyof typeof names;
const sessions = new Map<string, string>();

async function reset() {
  now = Date.UTC(2026, 10, 10, 3);
  logs.length = 0;
  sessions.clear();
  for (const table of tables) await db.prepare(`DELETE FROM ${table}`).run();
  await tombstones.prepare("DELETE FROM tombstones").run();
  for (const [id, name] of Object.entries(names))
    await db
      .prepare(
        "INSERT INTO users (id, display_name, created_at) VALUES (?, ?, 0)",
      )
      .bind(id, name)
      .run();
}
beforeEach(reset);

async function tokenFor(user: string, kind: "normal" | "recovery") {
  const key = user + ":" + kind;
  const cached = sessions.get(key);
  if (cached) return cached;
  const response = await app(
    new Request(origin + "/api/test/login", {
      method: "POST",
      body: JSON.stringify({ user, kind }),
      headers: { Origin: origin, "Content-Type": "application/json" },
    }),
    env,
  );
  const cookie = response.headers
    .getSetCookie()
    .find((value) => value.startsWith("__Host-session="))!;
  const token = cookie.split(";")[0]!.split("=")[1]!;
  sessions.set(key, token);
  return token;
}

type As = Name | "anonymous" | { recovery: Name };
async function call(
  as: As,
  method: string,
  path: string,
  body?: unknown,
): Promise<Response> {
  const headers: Record<string, string> = {};
  if (as !== "anonymous") {
    const token =
      typeof as === "string"
        ? await tokenFor(as, "normal")
        : await tokenFor(as.recovery, "recovery");
    headers.Cookie = "__Host-session=" + token;
  }
  if (method !== "GET") {
    headers.Origin = origin;
    if (body !== undefined) headers["Content-Type"] = "application/json";
  }
  return app(
    new Request(origin + path, {
      method,
      headers,
      ...(body !== undefined && { body: JSON.stringify(body) }),
    }),
    env,
  );
}
const read = async (response: Response) => ({
  status: response.status,
  body: (await response.json()) as unknown,
});

async function invite(user: Name) {
  const response = await call(user, "POST", "/api/invite");
  expect(response.status).toBe(200);
  const { url } = (await response.json()) as { url: string };
  return new URL(url).hash.slice("#t=".length);
}
const request = async (from: Name, to: Name) =>
  call(from, "POST", "/api/friend-requests", { token: await invite(to) });
async function befriend(a: Name, b: Name) {
  expect((await request(a, b)).status).toBe(200);
  expect(
    (await call(b, "POST", `/api/friend-requests/${a}/accept`)).status,
  ).toBe(200);
}
async function record(user: Name, cardId: string, memo = "秘密のメモ") {
  await db
    .prepare(
      "INSERT INTO records (user_id, card_id, received_on, memo, updated_at) VALUES (?, ?, '2026-11-01', ?, 0)",
    )
    .bind(user, cardId, memo)
    .run();
}
const rows = async (table: string) =>
  (await db.prepare(`SELECT * FROM ${table}`).all()).results;
const tombstoneRows = async () =>
  (
    await tombstones
      .prepare("SELECT kind, subject, object, created_at FROM tombstones")
      .all()
  ).results;

const notFound = { status: 404, body: { error: "not_found" } };

// The friends page reads its lists and the invite in one GET; `part` picks
// the one a test is about.
async function view(
  as: As,
  part: "friends" | "requests" | "blocks" | "invite",
) {
  const { status, body } = await read(await call(as, "GET", "/api/friends"));
  return status === 200
    ? { status, body: { [part]: (body as Record<string, unknown>)[part] } }
    : { status, body };
}

test("creates an invite link with a fragment token and stores only its hash", async () => {
  const response = await call("alice", "POST", "/api/invite");
  expect(response.status).toBe(200);
  const body = (await response.json()) as { url: string; expiresAt: number };
  const url = new URL(body.url);
  expect(url.origin + url.pathname).toBe(origin + "/friends/invite");
  // LINE opens this in the default browser, where passkeys work.
  expect(url.search).toBe("?openExternalBrowser=1");
  const token = url.hash.slice("#t=".length);
  expect(url.hash).toBe("#t=" + token);
  // 128 bits of base64url.
  expect(token).toMatch(/^[A-Za-z0-9_-]{22}$/);
  expect(body.expiresAt).toBe(now + 7 * DAY);
  expect(await rows("invites")).toEqual([
    {
      user_id: "alice",
      token_hash: createHash("sha256").update(token).digest("hex"),
      expires_at: now + 7 * DAY,
    },
  ]);
  expect(await view("alice", "invite")).toEqual({
    status: 200,
    body: { invite: { expiresAt: now + 7 * DAY } },
  });
});

test("reports no current invite before one is made and after it expires", async () => {
  expect(await view("alice", "invite")).toEqual({
    status: 200,
    body: { invite: { expiresAt: null } },
  });
  await invite("alice");
  now += 7 * DAY;
  expect(await view("alice", "invite")).toEqual({
    status: 200,
    body: { invite: { expiresAt: null } },
  });
});

test("looks up an invite without signing in and shows only the display name", async () => {
  const token = await invite("alice");
  expect(
    await read(
      await call("anonymous", "POST", "/api/invite/lookup", { token }),
    ),
  ).toEqual({ status: 200, body: { displayName: "アリス" } });
  expect(
    await read(await call("bob", "POST", "/api/invite/lookup", { token })),
  ).toEqual({ status: 200, body: { displayName: "アリス" } });
  // A recovery session is treated as signed out here.
  expect(
    await read(
      await call({ recovery: "bob" }, "POST", "/api/invite/lookup", { token }),
    ),
  ).toEqual({ status: 200, body: { displayName: "アリス" } });
});

test("answers the same 404 for unknown, malformed, expired and replaced invites", async () => {
  const old = await invite("alice");
  const replaced = await invite("alice");
  expect(replaced).not.toBe(old);
  now += 7 * DAY - 1;
  const lookup = (token: string) =>
    call("bob", "POST", "/api/invite/lookup", { token });
  expect((await lookup(replaced)).status).toBe(200);
  for (const token of [old, "A".repeat(22), "short", "!".repeat(22)])
    expect(await read(await lookup(token))).toEqual({
      status: 404,
      body: { error: "invite_not_found" },
    });
  now += 1;
  expect(await read(await lookup(replaced))).toEqual({
    status: 404,
    body: { error: "invite_not_found" },
  });
  expect(
    await read(
      await call("bob", "POST", "/api/friend-requests", { token: replaced }),
    ),
  ).toEqual({ status: 404, body: { error: "invite_not_found" } });
});

test.each([[undefined], [{}], [{ token: 1 }], [[]]])(
  "rejects the invite body %j",
  async (body) => {
    expect(
      await read(await call("bob", "POST", "/api/invite/lookup", body)),
    ).toEqual({ status: 400, body: { error: "invalid_body" } });
    expect(
      await read(await call("bob", "POST", "/api/friend-requests", body)),
    ).toEqual({ status: 400, body: { error: "invalid_body" } });
  },
);

test("uses an invite any number of times until it expires", async () => {
  const token = await invite("alice");
  for (const user of ["bob", "carol"] as const)
    expect(
      (await call(user, "POST", "/api/friend-requests", { token })).status,
    ).toBe(200);
  expect(
    (await rows("friend_requests")).map((row) => row.from_user_id).sort(),
  ).toEqual(["bob", "carol"]);
});

test("keeps one request per pair and its first date", async () => {
  const created = now;
  expect(await read(await request("bob", "alice"))).toEqual({
    status: 200,
    body: { ok: true },
  });
  now += DAY;
  expect(await read(await request("bob", "alice"))).toEqual({
    status: 200,
    body: { ok: true },
  });
  expect(await rows("friend_requests")).toEqual([
    { from_user_id: "bob", to_user_id: "alice", created_at: created },
  ]);
});

test("lists received requests with the sender's name and date only", async () => {
  await request("bob", "alice");
  now += 1000;
  await request("carol", "alice");
  expect(await view("alice", "requests")).toEqual({
    status: 200,
    body: {
      requests: [
        { userId: "carol", displayName: "キャロル", requestedAt: now },
        { userId: "bob", displayName: "ボブ", requestedAt: now - 1000 },
      ],
    },
  });
  // The sender never sees what they sent (AZ-5).
  expect(await view("bob", "requests")).toEqual({
    status: 200,
    body: { requests: [] },
  });
});

test("accepting makes both friends and clears both directions", async () => {
  await request("bob", "alice");
  await request("alice", "bob");
  // The reverse request already made them friends.
  expect(await rows("friend_requests")).toEqual([]);
  const since = now;
  for (const [user, other, name] of [
    ["alice", "bob", "ボブ"],
    ["bob", "alice", "アリス"],
  ] as const)
    expect(await view(user, "friends")).toEqual({
      status: 200,
      body: {
        friends: [{ userId: other, displayName: name, count: 0, since }],
      },
    });
});

test("accepts a received request", async () => {
  await request("bob", "alice");
  expect(
    await read(await call("alice", "POST", "/api/friend-requests/bob/accept")),
  ).toEqual({ status: 200, body: { ok: true } });
  expect(await rows("friendships")).toEqual([
    { user_a: "alice", user_b: "bob", created_at: now },
  ]);
  expect(await rows("friend_requests")).toEqual([]);
  // A request between friends changes nothing.
  expect((await request("bob", "alice")).status).toBe(200);
  expect(await rows("friend_requests")).toEqual([]);
});

test("cannot accept a request that was not received", async () => {
  await request("bob", "alice");
  for (const [user, path] of [
    ["bob", "/api/friend-requests/alice/accept"],
    ["carol", "/api/friend-requests/bob/accept"],
    ["alice", "/api/friend-requests/nobody/accept"],
  ] as const)
    expect(await read(await call(user, "POST", path))).toEqual(notFound);
  expect(await rows("friendships")).toEqual([]);
});

test("deleting a received request leaves no trace for the sender", async () => {
  await request("bob", "alice");
  expect(
    await read(await call("alice", "DELETE", "/api/friend-requests/bob")),
  ).toEqual({ status: 200, body: { ok: true } });
  expect(await rows("friend_requests")).toEqual([]);
  // Deleting a request one sent is not possible: the row stays.
  await request("bob", "alice");
  await call("bob", "DELETE", "/api/friend-requests/alice");
  expect(await rows("friend_requests")).toHaveLength(1);
});

test("shows a friend's cards, dates and count but never the memo", async () => {
  await befriend("bob", "alice");
  await record("bob", "13-100-A001");
  await db
    .prepare(
      "INSERT INTO records (user_id, card_id, received_on, memo, updated_at) VALUES ('bob', '01-100-A001', NULL, 'メモ2', 0)",
    )
    .run();
  const response = await call("alice", "GET", "/api/friends/bob/records");
  const text = await response.clone().text();
  expect(text).not.toContain("メモ");
  expect(text).not.toContain("memo");
  expect(await read(response)).toEqual({
    status: 200,
    body: {
      displayName: "ボブ",
      count: 2,
      records: [
        { cardId: "01-100-A001", receivedOn: null },
        { cardId: "13-100-A001", receivedOn: "2026-11-01" },
      ],
    },
  });
  expect(await view("alice", "friends")).toMatchObject({
    body: { friends: [{ userId: "bob", count: 2 }] },
  });
});

test("a friend with no records is not a 404", async () => {
  await befriend("bob", "alice");
  expect(
    await read(await call("alice", "GET", "/api/friends/bob/records")),
  ).toEqual({
    status: 200,
    body: { displayName: "ボブ", count: 0, records: [] },
  });
});

test("unfriending removes the pair for both and records a tombstone", async () => {
  await befriend("bob", "alice");
  await record("bob", "13-100-A001");
  now += 1000;
  expect(await read(await call("alice", "DELETE", "/api/friends/bob"))).toEqual(
    {
      status: 200,
      body: { ok: true },
    },
  );
  expect(await rows("friendships")).toEqual([]);
  expect(await tombstoneRows()).toEqual([
    { kind: "friendship", subject: "alice", object: "bob", created_at: now },
  ]);
  expect(
    await read(await call("alice", "GET", "/api/friends/bob/records")),
  ).toEqual(notFound);
  expect(
    await read(await call("bob", "GET", "/api/friends/alice/records")),
  ).toEqual(notFound);
  // Unfriending again changes nothing and writes no tombstone.
  expect((await call("alice", "DELETE", "/api/friends/bob")).status).toBe(200);
  expect(await tombstoneRows()).toHaveLength(1);
});

test("blocking removes the friendship and pending requests both ways", async () => {
  await befriend("bob", "alice");
  await request("carol", "alice");
  await request("alice", "dave");
  await request("dave", "carol");
  now += 1000;
  for (const user of ["bob", "carol", "dave"])
    expect(
      await read(await call("alice", "PUT", `/api/blocks/${user}`)),
    ).toEqual({ status: 200, body: { ok: true } });
  expect(await rows("friendships")).toEqual([]);
  // Only requests between other people stay.
  expect(await rows("friend_requests")).toEqual([
    { from_user_id: "dave", to_user_id: "carol", created_at: now - 1000 },
  ]);
  expect(await tombstoneRows()).toEqual(
    ["bob", "carol", "dave"].map((object) => ({
      kind: "block",
      subject: "alice",
      object,
      created_at: now,
    })),
  );
  expect(await view("alice", "blocks")).toEqual({
    status: 200,
    body: {
      blocks: [
        { userId: "bob", displayName: "ボブ", blockedAt: now },
        { userId: "carol", displayName: "キャロル", blockedAt: now },
        { userId: "dave", displayName: "デイブ", blockedAt: now },
      ],
    },
  });
});

test("a block of an unknown user answers like any block and stores nothing", async () => {
  expect(await read(await call("alice", "PUT", "/api/blocks/nobody"))).toEqual({
    status: 200,
    body: { ok: true },
  });
  expect(await rows("blocks")).toEqual([]);
  expect(await tombstoneRows()).toEqual([]);
});

// Every response the other person can get, after each way of ending.
async function viewOf(user: Name, other: Name) {
  const token = await invite(other);
  return {
    page: await read(await call(user, "GET", "/api/friends")),
    records: await read(
      await call(user, "GET", `/api/friends/${other}/records`),
    ),
    lookup: await read(
      await call(user, "POST", "/api/invite/lookup", { token }),
    ),
    request: await read(
      await call(user, "POST", "/api/friend-requests", { token }),
    ),
    accept: await read(
      await call(user, "POST", `/api/friend-requests/${other}/accept`),
    ),
    unfriend: await read(await call(user, "DELETE", `/api/friends/${other}`)),
  };
}

test("the blocked side sees exactly what an unfriended side sees", async () => {
  await befriend("bob", "alice");
  await record("alice", "13-100-A001");
  await call("alice", "DELETE", "/api/friends/bob");
  const unfriended = await viewOf("bob", "alice");

  for (const table of ["friendships", "friend_requests"])
    await db.prepare(`DELETE FROM ${table}`).run();
  await befriend("bob", "alice");
  await call("alice", "PUT", "/api/blocks/bob");
  const blocked = await viewOf("bob", "alice");

  expect(blocked).toEqual(unfriended);
  expect(blocked.request).toEqual({ status: 200, body: { ok: true } });
  expect(blocked.records).toEqual(notFound);
});

test("a request from a blocked user answers normally but is not stored", async () => {
  await call("alice", "PUT", "/api/blocks/bob");
  expect(await read(await request("bob", "alice"))).toEqual({
    status: 200,
    body: { ok: true },
  });
  // Nor does the blocker's own request reach the blocked user.
  expect(await read(await request("alice", "bob"))).toEqual({
    status: 200,
    body: { ok: true },
  });
  expect(await rows("friend_requests")).toEqual([]);
  expect(await rows("friendships")).toEqual([]);
});

test("unblocking does not restore the friendship", async () => {
  await befriend("bob", "alice");
  await call("alice", "PUT", "/api/blocks/bob");
  expect(await read(await call("alice", "DELETE", "/api/blocks/bob"))).toEqual({
    status: 200,
    body: { ok: true },
  });
  expect(await rows("blocks")).toEqual([]);
  expect(await rows("friendships")).toEqual([]);
  expect(
    await read(await call("alice", "GET", "/api/friends/bob/records")),
  ).toEqual(notFound);
  // A new request goes through again.
  await befriend("bob", "alice");
  expect(await rows("friendships")).toHaveLength(1);
});

test("a block made outside the friendship still hides the records", async () => {
  await befriend("bob", "alice");
  // Defence in depth: the records query checks blocks itself (AZ-1).
  await db
    .prepare(
      "INSERT INTO blocks (blocker_id, blocked_id, created_at) VALUES ('bob', 'alice', 0)",
    )
    .run();
  for (const [user, other] of [
    ["alice", "bob"],
    ["bob", "alice"],
  ] as const) {
    expect(
      await read(await call(user, "GET", `/api/friends/${other}/records`)),
    ).toEqual(notFound);
    expect(await view(user, "friends")).toEqual({
      status: 200,
      body: { friends: [] },
    });
  }
});

test("the friends page gets only the caller's lists and invite", async () => {
  const start = now;
  await befriend("bob", "alice");
  await request("carol", "alice");
  await request("dave", "bob");
  await call("alice", "PUT", "/api/blocks/dave");
  await call("bob", "PUT", "/api/blocks/carol");
  now += 1000;
  await invite("alice");
  expect(await read(await call("alice", "GET", "/api/friends"))).toEqual({
    status: 200,
    body: {
      friends: [{ userId: "bob", displayName: "ボブ", count: 0, since: start }],
      requests: [
        { userId: "carol", displayName: "キャロル", requestedAt: start },
      ],
      blocks: [{ userId: "dave", displayName: "デイブ", blockedAt: start }],
      invite: { expiresAt: now + 7 * DAY },
    },
  });
  expect(await read(await call("bob", "GET", "/api/friends"))).toEqual({
    status: 200,
    body: {
      friends: [
        { userId: "alice", displayName: "アリス", count: 0, since: start },
      ],
      requests: [{ userId: "dave", displayName: "デイブ", requestedAt: start }],
      blocks: [{ userId: "carol", displayName: "キャロル", blockedAt: start }],
      invite: { expiresAt: start + 7 * DAY },
    },
  });
});

test.each(["/api/friends", "/api/friends/bob/records"])(
  "GET %s reads the session and the data in one round trip to D1",
  async (path) => {
    await befriend("bob", "alice");
    await record("bob", "13-100-A001");
    const counter = countCalls(db);
    const response = await app(
      new Request(origin + path, {
        headers: {
          Cookie: "__Host-session=" + (await tokenFor("alice", "normal")),
        },
      }),
      { ...env, DB: counter.db },
    );
    expect(response.status).toBe(200);
    expect(counter.calls).toBe(1);
  },
);

test.each(["/api/friends", "/api/friends/bob/records"])(
  "GET %s with an expired session answers 401 and drops the session",
  async (path) => {
    await befriend("bob", "alice");
    await tokenFor("alice", "normal");
    now += 30 * DAY;
    const response = await call("alice", "GET", path);
    expect(await read(response)).toEqual({
      status: 401,
      body: { error: "unauthorized" },
    });
    expect(response.headers.getSetCookie()).toContain(
      "__Host-session=; Max-Age=0; Path=/; Secure; HttpOnly; SameSite=Lax",
    );
    expect(
      (await rows("sessions")).filter((row) => row.user_id === "alice"),
    ).toEqual([]);
  },
);

// Authorization matrix: every route for every relation to alice.
const matrixRoutes = [
  ["POST", "/api/invite"],
  ["POST", "/api/friend-requests"],
  ["POST", "/api/friend-requests/alice/accept"],
  ["DELETE", "/api/friend-requests/alice"],
  ["GET", "/api/friends"],
  ["GET", "/api/friends/alice/records"],
  ["DELETE", "/api/friends/alice"],
  ["PUT", "/api/blocks/alice"],
  ["DELETE", "/api/blocks/alice"],
] as const;

test.each(matrixRoutes)(
  "%s %s needs a normal session",
  async (method, path) => {
    const body =
      method === "POST" && path === "/api/friend-requests"
        ? { token: "x" }
        : undefined;
    expect(await read(await call("anonymous", method, path, body))).toEqual({
      status: 401,
      body: { error: "unauthorized" },
    });
    expect(
      await read(await call({ recovery: "bob" }, method, path, body)),
    ).toEqual({ status: 403, body: { error: "recovery_session" } });
  },
);

const relations: Record<string, (viewer: Name) => Promise<void>> = {
  self: async () => {},
  friend: (viewer) => befriend(viewer, "alice"),
  stranger: async () => {},
  "request sent": async (viewer) => {
    await request(viewer, "alice");
  },
  "request received": async (viewer) => {
    await request("alice", viewer);
  },
  unfriended: async (viewer) => {
    await befriend(viewer, "alice");
    await call("alice", "DELETE", `/api/friends/${viewer}`);
  },
  blocker: async (viewer) => {
    await befriend(viewer, "alice");
    await call(viewer, "PUT", "/api/blocks/alice");
  },
  blocked: async (viewer) => {
    await befriend(viewer, "alice");
    await call("alice", "PUT", "/api/blocks/" + viewer);
  },
  deleted: async () => {
    await db.prepare("DELETE FROM users WHERE id = 'alice'").run();
  },
};

test.each(Object.keys(relations))(
  "only a friend reads alice's records (%s)",
  async (relation) => {
    const viewer: Name = relation === "self" ? "alice" : "bob";
    await record("alice", "13-100-A001");
    await relations[relation]!(viewer);
    const response = await read(
      await call(viewer, "GET", "/api/friends/alice/records"),
    );
    if (relation === "friend")
      expect(response).toEqual({
        status: 200,
        body: {
          displayName: "アリス",
          count: 1,
          records: [{ cardId: "13-100-A001", receivedOn: "2026-11-01" }],
        },
      });
    else expect(response).toEqual(notFound);
    const friends = (await view(viewer, "friends")).body as {
      friends: { userId: string }[];
    };
    expect(friends.friends.map(({ userId }) => userId)).toEqual(
      relation === "friend" ? ["alice"] : [],
    );
    // The sender of a request never sees it; only its receiver does.
    const received = (await view(viewer, "requests")).body as {
      requests: { userId: string }[];
    };
    expect(received.requests.map(({ userId }) => userId)).toEqual(
      relation === "request received" ? ["alice"] : [],
    );
    const accepted = await call(
      viewer,
      "POST",
      "/api/friend-requests/alice/accept",
    );
    expect(accepted.status).toBe(relation === "request received" ? 200 : 404);
  },
);

test("caps received requests at 100 without telling the sender", async () => {
  const token = await invite("alice");
  const statements = [];
  for (let index = 0; index < 100; index++) {
    statements.push(
      db
        .prepare(
          "INSERT INTO users (id, display_name, created_at) VALUES (?, 'x', 0)",
        )
        .bind("u" + index),
      db
        .prepare(
          "INSERT INTO friend_requests (from_user_id, to_user_id, created_at) VALUES (?, 'alice', 0)",
        )
        .bind("u" + index),
    );
  }
  await db.batch(statements);
  expect(
    await read(await call("bob", "POST", "/api/friend-requests", { token })),
  ).toEqual({ status: 200, body: { ok: true } });
  expect(
    (await rows("friend_requests")).filter((row) => row.from_user_id === "bob"),
  ).toEqual([]);
});

test("caps friends at 200", async () => {
  const statements = [];
  for (let index = 0; index < 200; index++)
    statements.push(
      db
        .prepare(
          "INSERT INTO users (id, display_name, created_at) VALUES (?, 'x', 0)",
        )
        .bind("f" + String(index).padStart(3, "0")),
      db
        .prepare(
          "INSERT INTO friendships (user_a, user_b, created_at) VALUES ('alice', ?, 0)",
        )
        .bind("f" + String(index).padStart(3, "0")),
    );
  await db.batch(statements);
  await request("bob", "alice");
  expect(
    await read(await call("alice", "POST", "/api/friend-requests/bob/accept")),
  ).toEqual({ status: 409, body: { error: "friend_limit" } });
  // The request stays so it can be accepted after making room.
  expect(await rows("friend_requests")).toHaveLength(1);
  await call("alice", "DELETE", "/api/friends/f000");
  expect(
    (await call("alice", "POST", "/api/friend-requests/bob/accept")).status,
  ).toBe(200);
});

test("limits requests to 20 a day per sender", async () => {
  const token = await invite("alice");
  for (let index = 0; index < 20; index++)
    expect(
      (await call("bob", "POST", "/api/friend-requests", { token })).status,
    ).toBe(200);
  expect(
    await read(await call("bob", "POST", "/api/friend-requests", { token })),
  ).toEqual({ status: 429, body: { error: "rate_limited" } });
  // The day is the Japanese calendar day: it turns at 15:00 UTC.
  now = Date.UTC(2026, 10, 10, 15);
  expect(
    (await call("bob", "POST", "/api/friend-requests", { token })).status,
  ).toBe(200);
});

test("a late request from the previous day does not reset today's count", async () => {
  const token = await invite("alice");
  now = Date.UTC(2026, 10, 10, 15);
  for (let index = 0; index < 20; index++)
    expect(
      (await call("bob", "POST", "/api/friend-requests", { token })).status,
    ).toBe(200);
  // A request that started just before the day turned runs after them.
  now = Date.UTC(2026, 10, 10, 14, 59, 59);
  await call("bob", "POST", "/api/friend-requests", { token });
  now = Date.UTC(2026, 10, 10, 15, 0, 1);
  expect(
    (await call("bob", "POST", "/api/friend-requests", { token })).status,
  ).toBe(429);
});

test("limits writes to 60 a minute per user", async () => {
  for (let index = 0; index < 60; index++)
    expect((await call("alice", "DELETE", "/api/blocks/bob")).status).toBe(200);
  const limited = await call("alice", "POST", "/api/invite");
  expect(limited.status).toBe(429);
  expect(limited.headers.get("Retry-After")).toBe("60");
  // Reads are not counted, and another user is not affected.
  expect((await call("alice", "GET", "/api/friends")).status).toBe(200);
  expect((await call("bob", "POST", "/api/invite")).status).toBe(200);
  now += 60 * 1000;
  expect((await call("alice", "POST", "/api/invite")).status).toBe(200);
});

test("keeps invite tokens and names out of the log", async () => {
  const token = await invite("alice");
  await call("bob", "POST", "/api/invite/lookup", { token });
  await call("bob", "POST", "/api/friend-requests", { token });
  await call("bob", "POST", "/api/invite/lookup", { token: "A".repeat(22) });
  expect(logs.length).toBeGreaterThan(3);
  for (const line of logs) {
    expect(line).not.toContain(token);
    expect(line).not.toContain("アリス");
    expect(line).not.toContain("A".repeat(22));
  }
  expect(logs.map((line) => JSON.parse(line).route)).toContain(
    "POST /api/invite/lookup",
  );
});

test("works without the tombstones database", async () => {
  const { TOMBSTONES: _, ...withoutTombstones } = env;
  await befriend("bob", "alice");
  const response = await app(
    new Request(origin + "/api/friends/bob", {
      method: "DELETE",
      headers: {
        Origin: origin,
        Cookie: "__Host-session=" + (await tokenFor("alice", "normal")),
      },
    }),
    withoutTombstones,
  );
  expect(response.status).toBe(200);
  expect(await rows("friendships")).toEqual([]);
  expect(await tombstoneRows()).toEqual([]);
});

test("counts an old and a new card number once in both views", async () => {
  await befriend("bob", "alice");
  await record("bob", "13-100-OLD");
  await record("bob", "13-100-A001");
  await record("bob", "01-100-A001");
  const detail = await read(
    await call("alice", "GET", "/api/friends/bob/records"),
  );
  expect(detail.body).toEqual({
    displayName: "ボブ",
    count: 2,
    records: [
      { cardId: "01-100-A001", receivedOn: "2026-11-01" },
      { cardId: "13-100-A001", receivedOn: "2026-11-01" },
    ],
  });
  expect(await view("alice", "friends")).toMatchObject({
    body: { friends: [{ userId: "bob", count: 2 }] },
  });
  // An old number alone still counts once.
  await db.prepare("DELETE FROM records WHERE card_id = '13-100-A001'").run();
  expect(await view("alice", "friends")).toMatchObject({
    body: { friends: [{ userId: "bob", count: 2 }] },
  });
});

test("concurrent blocks of the same user both succeed", async () => {
  await db.batch([
    db.prepare(
      "INSERT INTO friendships (user_a, user_b, created_at) VALUES ('alice', 'bob', 0)",
    ),
    db.prepare(
      "INSERT INTO friend_requests (from_user_id, to_user_id, created_at) VALUES ('alice', 'bob', 0), ('bob', 'alice', 0)",
    ),
  ]);
  await tokenFor("alice", "normal");
  const responses = await Promise.all(
    [0, 1].map(() => call("alice", "PUT", "/api/blocks/bob")),
  );
  expect(await Promise.all(responses.map(read))).toEqual([
    { status: 200, body: { ok: true } },
    { status: 200, body: { ok: true } },
  ]);
  expect(await rows("friendships")).toEqual([]);
  expect(await rows("friend_requests")).toEqual([]);
  expect(await rows("blocks")).toEqual([
    { blocker_id: "alice", blocked_id: "bob", created_at: now },
  ]);
});

test("shares the minute write quota with the records API", async () => {
  for (let index = 0; index < 60; index++)
    expect(
      (await call("alice", "PUT", "/api/me/records/13-100-A001", {})).status,
    ).toBe(200);
  expect(await read(await call("alice", "PUT", "/api/blocks/bob"))).toEqual({
    status: 429,
    body: { error: "rate_limited" },
  });
});

// Every relation to alice × every friend route, from bob's side.
type State = { friends: number; requests: string[]; blocks: string[] };
async function state(): Promise<State> {
  const arrows = (list: Record<string, unknown>[], a: string, b: string) =>
    list.map((row) => `${row[a]}>${row[b]}`).sort();
  return {
    friends: (await rows("friendships")).length,
    requests: arrows(
      await rows("friend_requests"),
      "from_user_id",
      "to_user_id",
    ),
    blocks: arrows(await rows("blocks"), "blocker_id", "blocked_id"),
  };
}
const without = (list: string[], item: string) =>
  list.filter((value) => value !== item);
const before: Record<string, State> = {
  self: { friends: 0, requests: [], blocks: [] },
  stranger: { friends: 0, requests: [], blocks: [] },
  friend: { friends: 1, requests: [], blocks: [] },
  "request sent": { friends: 0, requests: ["bob>alice"], blocks: [] },
  "request received": { friends: 0, requests: ["alice>bob"], blocks: [] },
  unfriended: { friends: 0, requests: [], blocks: [] },
  blocker: { friends: 0, requests: [], blocks: ["bob>alice"] },
  blocked: { friends: 0, requests: [], blocks: ["alice>bob"] },
};
type Outcome = { response: unknown; state: State };
const operations: Record<
  string,
  {
    run: (viewer: Name) => Promise<unknown>;
    expect: (relation: string, start: State) => Outcome;
  }
> = {
  "create invite": {
    run: async (viewer) => (await call(viewer, "POST", "/api/invite")).status,
    expect: (_, start) => ({ response: 200, state: start }),
  },
  "look up alice's invite": {
    run: async (viewer) =>
      read(
        await call(viewer, "POST", "/api/invite/lookup", {
          token: await invite("alice"),
        }),
      ),
    expect: (relation, start) => ({
      response: {
        status: 200,
        body: {
          displayName: "アリス",
          ...(relation === "self" && { self: true }),
        },
      },
      state: start,
    }),
  },
  "request with alice's invite": {
    run: async (viewer) => read(await request(viewer, "alice")),
    expect: (relation, start) => {
      if (relation === "self")
        return {
          response: { status: 400, body: { error: "self_request" } },
          state: start,
        };
      const response = { status: 200, body: { ok: true } };
      if (relation === "stranger" || relation === "unfriended")
        return { response, state: { ...start, requests: ["bob>alice"] } };
      if (relation === "request received")
        return { response, state: { ...start, friends: 1, requests: [] } };
      return { response, state: start };
    },
  },
  "decline alice's request": {
    run: async (viewer) =>
      read(await call(viewer, "DELETE", "/api/friend-requests/alice")),
    expect: (_, start) => ({
      response: { status: 200, body: { ok: true } },
      state: { ...start, requests: without(start.requests, "alice>bob") },
    }),
  },
  "unfriend alice": {
    run: async (viewer) =>
      read(await call(viewer, "DELETE", "/api/friends/alice")),
    expect: (_, start) => ({
      response: { status: 200, body: { ok: true } },
      state: { ...start, friends: 0 },
    }),
  },
  "block alice": {
    run: async (viewer) => read(await call(viewer, "PUT", "/api/blocks/alice")),
    expect: (relation, start) =>
      relation === "self"
        ? {
            response: { status: 400, body: { error: "self_block" } },
            state: start,
          }
        : {
            response: { status: 200, body: { ok: true } },
            state: {
              friends: 0,
              requests: [],
              blocks: [
                ...without(start.blocks, "bob>alice"),
                "bob>alice",
              ].sort(),
            },
          },
  },
  "unblock alice": {
    run: async (viewer) =>
      read(await call(viewer, "DELETE", "/api/blocks/alice")),
    // bob cannot lift alice's block of bob.
    expect: (_, start) => ({
      response: { status: 200, body: { ok: true } },
      state: { ...start, blocks: without(start.blocks, "bob>alice") },
    }),
  },
  "list blocks": {
    run: async (viewer) => view(viewer, "blocks"),
    expect: (relation, start) => ({
      response: {
        status: 200,
        body: {
          blocks:
            relation === "blocker"
              ? [{ userId: "alice", displayName: "アリス", blockedAt: now }]
              : [],
        },
      },
      state: start,
    }),
  },
};

test.each(Object.keys(before))(
  "every friend route answers as expected for each relation (%s)",
  async (relation) => {
    const viewer: Name = relation === "self" ? "alice" : "bob";
    for (const [name, operation] of Object.entries(operations)) {
      await reset();
      await relations[relation]!(viewer);
      const start = await state();
      expect(start, relation).toEqual(before[relation]);
      const response = await operation.run(viewer);
      expect({ response, state: await state() }, name).toEqual(
        operation.expect(relation, start),
      );
    }
  },
);

test("unfriending marks its record done", async () => {
  await befriend("bob", "alice");
  expect((await call("alice", "DELETE", "/api/friends/bob")).status).toBe(200);
  const { results } = await tombstones
    .prepare("SELECT kind, state FROM tombstones ORDER BY id")
    .all();
  expect(results).toEqual([{ kind: "friendship", state: "done" }]);
});
