import { createHash } from "node:crypto";
import { afterAll, beforeAll, beforeEach, expect, test } from "vitest";
import { createApp, type Route } from "./app";
import type { Env } from "./env";
import { json } from "./http";
import { createSession, ME, readAsUser, requireSession } from "./session";
import { startWorker } from "./test-harness";

const origin = "https://manhole-techo.com";
const DAY = 24 * 60 * 60 * 1000;
const routes: Route[] = [
  {
    method: "POST",
    path: "/api/login",
    handle: async (context) => {
      const { user, kind } = context.body as {
        user: string;
        kind: "normal" | "recovery";
      };
      await createSession(context, user, kind);
      return json({ ok: true });
    },
  },
  {
    method: "GET",
    path: "/api/me",
    handle: async (context) => json(await requireSession(context)),
  },
  {
    method: "GET",
    path: "/api/read",
    handle: async (context) => {
      const {
        session,
        rows: [users],
      } = await readAsUser<[{ id: string; echo: string }]>(context, [
        `SELECT id, ?3 AS echo FROM users WHERE id = ${ME}`,
        "value",
      ]);
      return json({ userId: session.userId, users });
    },
  },
  {
    method: "GET",
    path: "/api/recovery",
    handle: async (context) =>
      json(await requireSession(context, { allowRecovery: true })),
  },
];

let running: Awaited<ReturnType<typeof startWorker>>;
let env: Env;
let now = 0;
const app = createApp({ routes, clock: () => now, log: () => {} });
beforeAll(async () => {
  running = await startWorker({ dev: true });
  env = {
    ...(await running.worker.getEnv()),
    ALLOWED_ORIGIN: origin,
    RP_ID: "manhole-techo.com",
  };
  await env
    .DB!.prepare(
      "INSERT INTO users (id, display_name, created_at) VALUES ('user-1', 'a', 0)",
    )
    .run();
});
afterAll(() => running.close());
beforeEach(async () => {
  now = Date.UTC(2026, 10, 10);
  await env.DB!.prepare("DELETE FROM sessions").run();
});

const cookies = (response: Response) => response.headers.getSetCookie();
const sessionCookie = (response: Response) =>
  cookies(response).find((cookie) => cookie.startsWith("__Host-session="));
const tokenOf = (cookie: string) => cookie.split(";")[0].split("=")[1];
const maxAge = (cookie: string) => Number(/Max-Age=(\d+)/.exec(cookie)![1]);
// What a browser sends after the cookies of the response: those it keeps.
const kept = (response: Response) =>
  cookies(response)
    .filter((cookie) => maxAge(cookie) > 0)
    .map((cookie) => cookie.split(";")[0])
    .join("; ");
// Signs in and returns the Cookie header the browser sends from then on.
const login = async (kind: "normal" | "recovery" = "normal", cookie = "") => {
  const response = await app(
    new Request(origin + "/api/login", {
      method: "POST",
      body: JSON.stringify({ user: "user-1", kind }),
      headers: {
        Origin: origin,
        "Content-Type": "application/json",
        ...(cookie && { Cookie: cookie }),
      },
    }),
    env,
  );
  expect(response.status).toBe(200);
  return kept(response);
};
const get = (path: string, cookie?: string) =>
  app(
    new Request(origin + path, {
      headers: cookie ? { Cookie: "a=b; " + cookie } : {},
    }),
    env,
  );
const only = (cookie: string) =>
  cookie.split("; ").find((part) => part.startsWith("__Host-session="))!;
const rows = async () =>
  (await env.DB!.prepare("SELECT * FROM sessions").all()).results;

test("issues a host-only secure cookie and stores only the hash", async () => {
  const response = await app(
    new Request(origin + "/api/login", {
      method: "POST",
      body: JSON.stringify({ user: "user-1", kind: "normal" }),
      headers: { Origin: origin, "Content-Type": "application/json" },
    }),
    env,
  );
  const cookie = sessionCookie(response)!;
  const token = tokenOf(cookie);
  expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
  const attributes = cookie.split("; ").slice(1);
  expect(attributes.sort()).toEqual(
    ["HttpOnly", "Max-Age=15552000", "Path=/", "SameSite=Lax", "Secure"].sort(),
  );
  expect(cookie).not.toMatch(/Domain=/i);
  expect(cookies(response)).toContain(
    "signed_in=1; Max-Age=15552000; Path=/; Secure; SameSite=Lax",
  );
  const stored = await rows();
  expect(stored).toEqual([
    {
      token_hash: createHash("sha256").update(token).digest("hex"),
      user_id: "user-1",
      kind: "normal",
      created_at: now,
      expires_at: now + 30 * DAY,
      verified_at: now,
    },
  ]);
  expect(JSON.stringify(stored)).not.toContain(token);
});

// Not secret: the pages compare it to see that another user has signed in.
const markOf = (response: Response) =>
  cookies(response).find((cookie) => cookie.startsWith("session_mark="));
test("marks each session with a readable value that reveals nothing of its token", async () => {
  const signIn = () =>
    app(
      new Request(origin + "/api/login", {
        method: "POST",
        body: JSON.stringify({ user: "user-1", kind: "normal" }),
        headers: { Origin: origin, "Content-Type": "application/json" },
      }),
      env,
    );
  const first = await signIn();
  const second = await signIn();
  const marks = [markOf(first)!, markOf(second)!];
  for (const [index, mark] of marks.entries()) {
    expect(mark).toMatch(
      /^session_mark=[0-9a-f]{16}; Max-Age=15552000; Path=\/; Secure; SameSite=Lax$/,
    );
    const token = tokenOf(sessionCookie([first, second][index])!);
    const value = tokenOf(mark);
    const hash = createHash("sha256").update(token).digest("hex");
    expect(token).not.toContain(value);
    expect(hash).not.toContain(value);
  }
  expect(tokenOf(marks[0])).not.toBe(tokenOf(marks[1]));
});
const sha256 = (value: string) =>
  createHash("sha256").update(value).digest("hex");
// Cookies issued before the current mark lasted only to the idle expiry, and
// some sessions have no mark at all: those get the cookies again, to the
// absolute expiry, and then keep them.
test.each([
  ["no mark", () => ""],
  [
    "the mark of before",
    (token: string) =>
      "; session_mark=" + sha256("session_mark:" + sha256(token)).slice(0, 16),
  ],
])(
  "sends the cookies again, to the absolute expiry, for %s",
  async (_, mark) => {
    const issued = await login();
    now += 10 * DAY;
    const session = only(issued);
    const old =
      session + "; signed_in=1" + mark(session.slice("__Host-session=".length));
    const response = await get("/api/me", old);
    expect(response.status).toBe(200);
    const age = 170 * 24 * 60 * 60;
    expect(maxAge(sessionCookie(response)!)).toBe(age);
    expect(cookies(response)).toContain(
      `signed_in=1; Max-Age=${age}; Path=/; Secure; SameSite=Lax`,
    );
    expect(kept(response)).toBe(issued);
    now += DAY;
    expect(cookies(await get("/api/me", issued))).toEqual([]);
  },
);

test("reads the session from the cookie", async () => {
  const token = await login();
  const response = await get("/api/me", token);
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({
    userId: "user-1",
    kind: "normal",
  });
  expect(cookies(response)).toEqual([]);
});

// A 401 may arrive after another user has signed in on the same browser:
// clearing the cookies then would sign that user out. The pages forget
// their display cookies themselves, when the 401 is for whoever they show.
test.each([
  ["no cookie", undefined],
  ["a malformed token", "__Host-session=short"],
  ["an unknown token", "__Host-session=" + "A".repeat(43)],
])("answers 401 for %s without touching the cookies", async (_, cookie) => {
  const response = await get("/api/me", cookie);
  expect(response.status).toBe(401);
  expect(await response.json()).toEqual({ error: "unauthorized" });
  expect(cookies(response)).toEqual([]);
});

test("answers 401 for a session replaced by another login without touching the cookies", async () => {
  const first = await login();
  const second = await login("normal", first);
  const late = await get("/api/me", first);
  expect(late.status).toBe(401);
  expect(cookies(late)).toEqual([]);
  expect((await get("/api/me", second)).status).toBe(200);
});

// The browser's cookies already last to the absolute expiry; sending them
// again could put back a user who has been replaced since.
test("slides the expiry at most once a day without sending the cookies", async () => {
  const token = await login();
  now += DAY - 1;
  const early = await get("/api/me", token);
  expect(cookies(early)).toEqual([]);
  expect((await rows())[0].expires_at).toBe(now - DAY + 1 + 30 * DAY);
  now += 1;
  const later = await get("/api/me", token);
  expect(later.status).toBe(200);
  expect(cookies(later)).toEqual([]);
  expect((await rows())[0].expires_at).toBe(now + 30 * DAY);
});

test("ends a session 180 days after creation", async () => {
  const created = now;
  const token = await login();
  // Use it just inside each 30-day idle limit until the 180-day cap.
  for (const day of [29, 58, 87, 116, 145, 174, 179]) {
    now = created + day * DAY;
    expect((await get("/api/me", token)).status).toBe(200);
  }
  expect((await rows())[0].expires_at).toBe(created + 180 * DAY);
  now = created + 180 * DAY - 1;
  const last = await get("/api/me", token);
  expect(last.status).toBe(200);
  expect(cookies(last)).toEqual([]);
  now = created + 180 * DAY;
  expect((await get("/api/me", token)).status).toBe(401);
  expect(await rows()).toEqual([]);
});

test("expires a session 30 days after the last use and deletes it", async () => {
  const token = await login();
  now += 30 * DAY;
  const response = await get("/api/me", token);
  expect(response.status).toBe(401);
  expect(cookies(response)).toEqual([]);
  expect(await rows()).toEqual([]);
});

test("limits a recovery session to recovery routes for 15 minutes", async () => {
  const response = await app(
    new Request(origin + "/api/login", {
      method: "POST",
      body: JSON.stringify({ user: "user-1", kind: "recovery" }),
      headers: { Origin: origin, "Content-Type": "application/json" },
    }),
    env,
  );
  // The pages must not fetch records the session cannot read.
  expect(cookies(response)).toContain(
    "signed_in=; Max-Age=0; Path=/; Secure; SameSite=Lax",
  );
  expect(cookies(response)).toContain(
    "session_mark=; Max-Age=0; Path=/; Secure; SameSite=Lax",
  );
  expect(maxAge(sessionCookie(response)!)).toBe(15 * 60);
  await env.DB!.prepare("DELETE FROM sessions").run();
  const token = await login("recovery");
  const forbidden = await get("/api/me", token);
  expect(forbidden.status).toBe(403);
  expect(await forbidden.json()).toEqual({ error: "recovery_session" });
  expect((await get("/api/recovery", token)).status).toBe(200);
  expect((await rows())[0]).toMatchObject({
    kind: "recovery",
    expires_at: now + 15 * 60 * 1000,
    verified_at: null,
  });
  now += 15 * 60 * 1000 - 1;
  const late = await get("/api/recovery", token);
  expect(cookies(late)).toEqual([]);
  now += 1;
  const expired = await get("/api/recovery", token);
  expect(expired.status).toBe(401);
  expect(cookies(expired)).toEqual([]);
});

test("replaces the presented session on a new login", async () => {
  const first = await login();
  const second = await login("normal", first);
  expect(second).not.toBe(first);
  expect(await rows()).toHaveLength(1);
  expect((await get("/api/me", first)).status).toBe(401);
  expect((await get("/api/me", second)).status).toBe(200);
});

test("reads rows as the session user in the same round trip", async () => {
  const token = await login();
  const response = await get("/api/read", token);
  expect(await response.json()).toEqual({
    userId: "user-1",
    users: [{ id: "user-1", echo: "value" }],
  });
  expect(cookies(response)).toEqual([]);
});

test.each([
  ["no cookie", undefined],
  ["a malformed token", "__Host-session=short"],
  ["an unknown token", "__Host-session=" + "A".repeat(43)],
])("reads nothing for %s", async (_, cookie) => {
  const response = await get("/api/read", cookie);
  expect(response.status).toBe(401);
  expect(await response.json()).toEqual({ error: "unauthorized" });
  expect(cookies(response)).toEqual([]);
});

test("reads nothing for a recovery session", async () => {
  const response = await get("/api/read", await login("recovery"));
  expect(response.status).toBe(403);
  expect(await response.json()).toEqual({ error: "recovery_session" });
});

test("reads nothing for an expired session and deletes it", async () => {
  const token = await login();
  now += 30 * DAY;
  const response = await get("/api/read", token);
  expect(response.status).toBe(401);
  expect(cookies(response)).toEqual([]);
  expect(await rows()).toEqual([]);
});

test("slides the expiry when reading as the session user", async () => {
  const token = await login();
  now += DAY;
  const response = await get("/api/read", token);
  expect(response.status).toBe(200);
  expect(cookies(response)).toEqual([]);
  expect((await rows())[0].expires_at).toBe(now + 30 * DAY);
});
