import { afterAll, beforeAll, beforeEach, expect, test, vi } from "vitest";
import { createApp, type Route } from "./app";
import type { Env } from "./env";
import { HttpError, json } from "./http";
import { startWorker } from "./test-harness";

const origin = "https://manhole-techo.com";
const routes: Route[] = [
  {
    method: "POST",
    path: "/api/echo",
    handle: ({ body }) => json({ body }),
  },
  {
    method: "PUT",
    path: "/api/items/:id",
    handle: ({ params, body }) => json({ params, body }),
  },
  {
    method: "DELETE",
    path: "/api/items/:id",
    handle: ({ params }) => json({ deleted: params.id }),
  },
  {
    method: "POST",
    path: "/api/webauthn",
    body: "webauthn",
    handle: () => json({ ok: true }),
  },
  { method: "GET", path: "/api/read", handle: () => json({ ok: true }) },
  {
    method: "GET",
    path: "/api/conflict",
    handle: () => {
      throw new HttpError(409, "conflict");
    },
  },
  {
    method: "GET",
    path: "/api/crash",
    handle: () => {
      throw new Error("secret detail");
    },
  },
];

let running: Awaited<ReturnType<typeof startWorker>>;
let env: Env;
const logs: string[] = [];
const app = createApp({ routes, log: (line) => logs.push(line) });
beforeAll(async () => {
  running = await startWorker({ dev: true });
  env = {
    ...(await running.worker.getEnv()),
    ALLOWED_ORIGIN: origin,
    RP_ID: "manhole-techo.com",
  };
});
afterAll(() => running.close());
beforeEach(() => {
  logs.length = 0;
});

const call = (path: string, init: RequestInit = {}) =>
  app(new Request("https://manhole-techo.com" + path, init), env);
const send = (
  path: string,
  body: BodyInit | null,
  headers: Record<string, string> = {},
  method = "POST",
) =>
  call(path, {
    method,
    body,
    headers: { Origin: origin, "Content-Type": "application/json", ...headers },
  });

// Previews upload without D1 (TE-1), so the API must answer as if absent.
test("answers every API path with a JSON 404 when DB is not bound", async () => {
  const { DB: _db, ...withoutDb } = env;
  for (const path of ["/api/health", "/api/read", "/api/"]) {
    const response = await app(
      new Request("https://manhole-techo.com" + path),
      withoutDb as Env,
    );
    expect(response.status).toBe(404);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(await response.json()).toEqual({ error: "not_found" });
  }
});
test("accepts a same-origin JSON body", async () => {
  const response = await send("/api/echo", '{"a":1}');
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ body: { a: 1 } });
});
test("matches path parameters", async () => {
  const response = await send("/api/items/13-100-A001", "{}", {}, "PUT");
  expect(await response.json()).toEqual({
    params: { id: "13-100-A001" },
    body: {},
  });
});
test("accepts a DELETE without a body", async () => {
  const response = await call("/api/items/x", {
    method: "DELETE",
    headers: { Origin: origin },
  });
  expect(response.status).toBe(200);
});
test("accepts a JSON media type with parameters", async () => {
  const response = await send("/api/echo", "{}", {
    "Content-Type": "application/json; charset=utf-8",
  });
  expect(response.status).toBe(200);
});
test("reads without an Origin", async () => {
  expect((await call("/api/read")).status).toBe(200);
});

test.each([
  ["a missing Origin", { Origin: "" }],
  ["another site", { Origin: "https://evil.example" }],
  ["another scheme", { Origin: "http://manhole-techo.com" }],
  ["a subdomain", { Origin: "https://pr-1.manhole-techo.com" }],
  ["a trailing slash", { Origin: origin + "/" }],
  ["the literal null", { Origin: "null" }],
])("forbids a state change from %s", async (_, headers) => {
  const init = { Origin: origin, "Content-Type": "application/json" };
  const merged = Object.fromEntries(
    Object.entries({ ...init, ...headers }).filter(([, value]) => value),
  );
  for (const method of ["POST", "PUT", "DELETE"]) {
    const path = method === "POST" ? "/api/echo" : "/api/items/x";
    const response = await call(path, { method, body: "{}", headers: merged });
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "forbidden_origin" });
  }
});
test("forbids a state change when the allowed origin is unset", async () => {
  const response = await app(
    new Request(origin + "/api/echo", {
      method: "POST",
      body: "{}",
      headers: { Origin: origin, "Content-Type": "application/json" },
    }),
    { ...env, ALLOWED_ORIGIN: "" },
  );
  expect(response.status).toBe(403);
});

test.each([
  ["a form post", "application/x-www-form-urlencoded", "a=1"],
  ["a multipart form", "multipart/form-data; boundary=x", "--x--"],
  ["plain text", "text/plain", "{}"],
  ["a JSON look-alike", "application/jsonp", "{}"],
])("rejects %s with 415", async (_, type, body) => {
  const response = await send("/api/echo", body, { "Content-Type": type });
  expect(response.status).toBe(415);
});
test("rejects a body without a content type", async () => {
  const response = await call("/api/echo", {
    method: "POST",
    headers: { Origin: origin },
    body: new Blob(["{}"]),
  });
  expect(response.status).toBe(415);
});
test("rejects malformed JSON", async () => {
  const response = await send("/api/echo", "{");
  expect(response.status).toBe(400);
  expect(await response.json()).toEqual({ error: "invalid_json" });
});

const KiB = 1024;
const jsonOfSize = (size: number) => '"' + "a".repeat(size - 2) + '"';
test.each([
  ["/api/echo", 16 * KiB],
  ["/api/webauthn", 64 * KiB],
])("limits the body of %s to %i bytes", async (path, limit) => {
  expect((await send(path, jsonOfSize(limit))).status).toBe(200);
  const over = await send(path, jsonOfSize(limit + 1));
  expect(over.status).toBe(413);
  expect(await over.json()).toEqual({ error: "payload_too_large" });
});
test("limits a streamed body without a length", async () => {
  const chunk = new TextEncoder().encode("a".repeat(8 * KiB));
  let sent = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (sent++ < 4) controller.enqueue(chunk);
      else controller.close();
    },
  });
  const response = await call("/api/echo", {
    method: "POST",
    body,
    headers: { Origin: origin, "Content-Type": "application/json" },
    duplex: "half",
  } as RequestInit);
  expect(response.status).toBe(413);
});

test.each([
  ["/api/read", "GET", 200],
  ["/api/conflict", "GET", 409],
  ["/api/crash", "GET", 500],
  ["/api/__missing__", "GET", 404],
  ["/api/read", "POST", 405],
])("sets private headers on %s %s", async (path, method, status) => {
  const response = await call(path, {
    method,
    headers: { Origin: origin },
  });
  expect(response.status).toBe(status);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  expect(response.headers.get("referrer-policy")).toBe("same-origin");
  expect(response.headers.get("content-type")).toContain("application/json");
});
test("hides internal error details", async () => {
  const response = await call("/api/crash");
  expect(await response.json()).toEqual({ error: "internal" });
});

test("logs the route template, never the request contents", async () => {
  const token = "c2VjcmV0LXRva2VuLXZhbHVlLXRoYXQtbXVzdC1ub3QtbGVhaw";
  await call("/api/items/13-100-A001?t=" + token, {
    method: "PUT",
    body: JSON.stringify({ memo: "private memo " + token }),
    headers: {
      Origin: origin,
      "Content-Type": "application/json",
      Cookie: "__Host-session=" + token,
    },
  });
  await call("/api/crash?t=" + token);
  expect(logs).toHaveLength(2);
  const [first, second] = logs.map((line) => JSON.parse(line));
  expect(first).toMatchObject({
    route: "PUT /api/items/:id",
    status: 200,
  });
  expect(second).toMatchObject({
    route: "GET /api/crash",
    status: 500,
    error: "Error",
  });
  for (const line of logs) {
    expect(line).not.toContain(token);
    expect(line).not.toContain("13-100-A001");
    expect(line).not.toContain("secret detail");
    expect(line).not.toContain("manhole-techo.com");
  }
});
test("logs through console by default", async () => {
  const spy = vi.spyOn(console, "log").mockImplementation(() => {});
  await createApp({ routes })(new Request(origin + "/api/read"), env);
  expect(spy).toHaveBeenCalledOnce();
  spy.mockRestore();
});
