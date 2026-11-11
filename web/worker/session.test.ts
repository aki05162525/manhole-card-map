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
const tokenOf = (cookie: string) => cookie.split(";")[0]!.split("=")[1]!;
const maxAge = (cookie: string) => Number(/Max-Age=(\d+)/.exec(cookie)![1]);
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
  return tokenOf(sessionCookie(response)!);
};
const get = (path: string, token?: string) =>
  app(
    new Request(origin + path, {
      headers: token ? { Cookie: "a=b; __Host-session=" + token } : {},
    }),
    env,
  );
const rows = async () =>
  (
    await env
      .DB!.prepare("SELECT * FROM sessions")
      .all<Record<string, unknown>>()
  ).results;

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
    ["HttpOnly", "Max-Age=2592000", "Path=/", "SameSite=Lax", "Secure"].sort(),
  );
  expect(cookie).not.toMatch(/Domain=/i);
  expect(cookies(response)).toContain(
    "signed_in=1; Max-Age=2592000; Path=/; Secure; SameSite=Lax",
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

test("reads the session from the cookie", async () => {
  const token = await login();
  const response = await get("/api/me", token);
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({
    userId: "user-1",
    kind: "normal",
  });
  expect(sessionCookie(response)).toBeUndefined();
});

test.each([
  ["no cookie", undefined],
  ["a malformed token", "short"],
  ["an unknown token", "A".repeat(43)],
])("answers 401 for %s", async (_, token) => {
  const response = await get("/api/me", token);
  expect(response.status).toBe(401);
  expect(await response.json()).toEqual({ error: "unauthorized" });
  if (token)
    expect(cookies(response)).toEqual([
      "__Host-session=; Max-Age=0; Path=/; Secure; HttpOnly; SameSite=Lax",
      "signed_in=; Max-Age=0; Path=/; Secure; SameSite=Lax",
    ]);
});

test("slides the expiry at most once a day", async () => {
  const token = await login();
  now += DAY - 1;
  const early = await get("/api/me", token);
  expect(sessionCookie(early)).toBeUndefined();
  expect((await rows())[0]!.expires_at).toBe(now - DAY + 1 + 30 * DAY);
  now += 1;
  const later = await get("/api/me", token);
  expect(maxAge(sessionCookie(later)!)).toBe(30 * 24 * 60 * 60);
  expect((await rows())[0]!.expires_at).toBe(now + 30 * DAY);
});

test("ends a session 180 days after creation", async () => {
  const created = now;
  const token = await login();
  // Use it just inside each 30-day idle limit until the 180-day cap.
  for (const day of [29, 58, 87, 116, 145, 174, 179]) {
    now = created + day * DAY;
    expect((await get("/api/me", token)).status).toBe(200);
  }
  expect((await rows())[0]!.expires_at).toBe(created + 180 * DAY);
  now = created + 180 * DAY - 1;
  const last = await get("/api/me", token);
  expect(last.status).toBe(200);
  expect(sessionCookie(last)).toBeUndefined();
  now = created + 180 * DAY;
  expect((await get("/api/me", token)).status).toBe(401);
  expect(await rows()).toEqual([]);
});

test("expires a session 30 days after the last use", async () => {
  const token = await login();
  now += 30 * DAY;
  expect((await get("/api/me", token)).status).toBe(401);
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
  expect(sessionCookie(late)).toBeUndefined();
  now += 1;
  expect((await get("/api/recovery", token)).status).toBe(401);
});

test("replaces the presented session on a new login", async () => {
  const first = await login();
  const second = await login("normal", "__Host-session=" + first);
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
  expect(sessionCookie(response)).toBeUndefined();
});

test.each([
  ["no cookie", undefined],
  ["a malformed token", "short"],
  ["an unknown token", "A".repeat(43)],
])("reads nothing for %s", async (_, token) => {
  const response = await get("/api/read", token);
  expect(response.status).toBe(401);
  expect(await response.json()).toEqual({ error: "unauthorized" });
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
  expect(cookies(response)).toContain(
    "__Host-session=; Max-Age=0; Path=/; Secure; HttpOnly; SameSite=Lax",
  );
  expect(await rows()).toEqual([]);
});

test("slides the expiry when reading as the session user", async () => {
  const token = await login();
  now += DAY;
  const response = await get("/api/read", token);
  expect(response.status).toBe(200);
  expect(maxAge(sessionCookie(response)!)).toBe(30 * 24 * 60 * 60);
  expect((await rows())[0]!.expires_at).toBe(now + 30 * DAY);
});
