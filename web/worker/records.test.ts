import { createHash } from "node:crypto";
import { afterAll, beforeAll, beforeEach, expect, test, vi } from "vitest";
import { createApp } from "./app";
import type { Env } from "./env";
import { routes } from "./routes";
import { startWorker } from "./test-harness";

vi.mock("../../data/card-ids.json", () => ({
  default: {
    ids: ["13-100-A001", "13-100-B001", "old"],
    aliases: { old: "13-100-A001" },
    excluded: { removed: "withdrawn" },
  },
}));
const card = "13-100-A001";
const origin = "https://manhole-techo.com";
let running: Awaited<ReturnType<typeof startWorker>>;
let env: Env;
let now: number;
let logs: string[];
const app = createApp({
  routes,
  clock: () => now,
  log: (line) => logs.push(line),
});
const tokens = {
  normal: "a".repeat(43),
  recovery: "b".repeat(43),
  other: "c".repeat(43),
};
beforeAll(async () => {
  running = await startWorker({ dev: true });
  env = {
    ...(await running.worker.getEnv()),
    ALLOWED_ORIGIN: origin,
    RP_ID: "manhole-techo.com",
  };
  await env
    .DB!.prepare(
      "INSERT INTO users VALUES ('one', 'One', 0), ('two', 'Two', 0)",
    )
    .run();
});
afterAll(() => running.close());
beforeEach(async () => {
  now = Date.UTC(2026, 10, 10, 15); // November 11 in Japan.
  logs = [];
  for (const table of ["records", "sessions"])
    await env.DB!.prepare(`DELETE FROM ${table}`).run();
  await env.DB!.prepare("DELETE FROM records_write_events").run();
  for (const [kind, token] of Object.entries(tokens)) {
    await env
      .DB!.prepare("INSERT INTO sessions VALUES (?, ?, ?, ?, ?, ?)")
      .bind(
        createHash("sha256").update(token).digest("hex"),
        kind === "other" ? "two" : "one",
        kind === "recovery" ? "recovery" : "normal",
        now,
        now + 86400000 * 30,
        now,
      )
      .run();
  }
});
async function call(
  method = "GET",
  id: string | null = card,
  body?: unknown,
  token: string | null = tokens.normal,
) {
  const response = await app(
    new Request(origin + "/api/me/records" + (id === null ? "" : "/" + id), {
      method,
      headers: {
        Origin: origin,
        "Content-Type": "application/json",
        ...(token ? { Cookie: "__Host-session=" + token } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    }),
    env,
  );
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  return response;
}
const seed = async (id = card, user = "one", memo = "private memo") => {
  await env
    .DB!.prepare("INSERT INTO records VALUES (?, ?, '2026-11-10', ?, 1)")
    .bind(user, id, memo)
    .run();
};
const rows = async () =>
  (
    await env
      .DB!.prepare("SELECT * FROM records ORDER BY user_id, card_id")
      .all()
  ).results;

test.each(["GET", "PUT", "DELETE"])(
  "requires a normal session for %s",
  async (method) => {
    expect(
      (await call(method, card, method === "PUT" ? {} : undefined, null))
        .status,
    ).toBe(401);
    expect(
      (
        await call(
          method,
          card,
          method === "PUT" ? {} : undefined,
          tokens.recovery,
        )
      ).status,
    ).toBe(403);
  },
);
test("also protects the list", async () => {
  expect((await call("GET", null, undefined, null)).status).toBe(401);
  expect((await call("GET", null, undefined, tokens.recovery)).status).toBe(
    403,
  );
});
test("isolates reads and writes by the session user", async () => {
  await seed(card, "two");
  expect(await (await call("GET", null)).json()).toEqual([]);
  expect((await call()).status).toBe(404);
  expect(
    (await call("PUT", card, { memo: "mine", user_id: "two" })).status,
  ).toBe(400);
  expect((await call("PUT", card, { memo: "mine" })).status).toBe(200);
  expect((await call("DELETE")).status).toBe(204);
  expect(await rows()).toEqual([
    expect.objectContaining({ user_id: "two", memo: "private memo" }),
  ]);
});
test("PUT and DELETE are idempotent and list omits the memo", async () => {
  const body = { receivedOn: "2026-11-11", memo: "secret" };
  for (let n = 0; n < 2; n++) {
    const response = await call("PUT", card, body);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      cardId: card,
      ...body,
      updatedAt: now,
    });
  }
  expect(await rows()).toHaveLength(1);
  expect(await (await call("GET", null)).json()).toEqual([
    { cardId: card, receivedOn: body.receivedOn },
  ]);
  expect(await (await call()).json()).toEqual({
    cardId: card,
    ...body,
    updatedAt: now,
  });
  expect(logs.join("")).not.toContain("secret");
  for (let n = 0; n < 2; n++) expect((await call("DELETE")).status).toBe(204);
});
test("preserves omitted fields and clears explicit nulls", async () => {
  await seed();
  expect((await call("PUT", card, {})).status).toBe(200);
  expect(await (await call()).json()).toMatchObject({
    receivedOn: "2026-11-10",
    memo: "private memo",
  });
  expect(
    (await call("PUT", card, { receivedOn: null, memo: null })).status,
  ).toBe(200);
  expect(await (await call()).json()).toMatchObject({
    receivedOn: null,
    memo: null,
  });
});
test("canonicalizes new and stored alias records", async () => {
  expect((await call("PUT", "old", {})).status).toBe(200);
  expect(await rows()).toEqual([expect.objectContaining({ card_id: card })]);
  await call("DELETE");
  await seed("old");
  expect(await (await call("GET", null)).json()).toEqual([
    { cardId: card, receivedOn: "2026-11-10" },
  ]);
  expect(await (await call()).json()).toMatchObject({
    cardId: card,
    memo: "private memo",
  });
  expect((await call("PUT", card, { memo: "updated" })).status).toBe(200);
  expect(await rows()).toEqual([
    expect.objectContaining({ card_id: card, memo: "updated" }),
  ]);
  expect((await call("DELETE", "old")).status).toBe(204);
  expect(await rows()).toEqual([]);
});
test("keeps alias collisions in the list and refuses destructive ambiguity", async () => {
  await seed("old", "one", "old secret");
  await seed();
  const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
  try {
    expect(await (await call("GET", null)).json()).toEqual([
      { cardId: card, receivedOn: "2026-11-10" },
      { cardId: card, receivedOn: "2026-11-10" },
    ]);
    expect(warning).toHaveBeenCalled();
    expect(JSON.stringify(warning.mock.calls)).not.toContain("secret");
    for (const method of ["GET", "PUT", "DELETE"])
      expect(
        (await call(method, card, method === "PUT" ? {} : undefined)).status,
      ).toBe(409);
    expect(await rows()).toHaveLength(2);
  } finally {
    warning.mockRestore();
  }
});
test("rejects new excluded cards but permits existing edits and cancellation", async () => {
  expect((await call("PUT", "removed", {})).status).toBe(404);
  await seed("removed");
  expect((await call("PUT", "removed", { memo: "edited" })).status).toBe(200);
  expect(await (await call("GET", "removed")).json()).toMatchObject({
    memo: "edited",
  });
  expect((await call("DELETE", "removed")).status).toBe(204);
  expect((await call("DELETE", "removed")).status).toBe(204);
});
test.each(["GET", "PUT", "DELETE"])(
  "unknown card returns 404 for %s",
  async (method) => {
    expect(
      (await call(method, "unknown", method === "PUT" ? {} : undefined)).status,
    ).toBe(404);
  },
);
test.each([
  "2026-02-29",
  "2026-04-31",
  "2026-00-01",
  "2026-13-01",
  "2026-11-12",
  "2026-1-01",
  "0000-01-01",
  1,
  true,
  "",
])("rejects invalid or future date %s", async (receivedOn) => {
  expect((await call("PUT", card, { receivedOn })).status).toBe(400);
});
test.each(["2024-02-29", "0001-01-01", "2026-11-11", null])(
  "accepts date %s",
  async (receivedOn) => {
    expect((await call("PUT", card, { receivedOn })).status).toBe(200);
  },
);
test("uses Japan's date at the midnight boundary", async () => {
  now--;
  expect((await call("PUT", card, { receivedOn: "2026-11-11" })).status).toBe(
    400,
  );
});
test("counts 500 graphemes for memo, matching display names", async () => {
  const memo = "👨‍👩‍👧‍👦".repeat(500);
  expect((await call("PUT", card, { memo })).status).toBe(200);
  expect((await call("PUT", card, { memo: memo + "a" })).status).toBe(400);
  expect((await call("PUT", card, { memo: "" })).status).toBe(200);
});
test.each([
  [[]],
  [null],
  ["text"],
  [{ memo: 1 }],
  [{ receivedOn: [] }],
  [{ extra: true }],
])("rejects invalid body %j", async (body) => {
  expect((await call("PUT", card, body)).status).toBe(400);
});
test("limits combined PUT/DELETE writes per user in a rolling minute", async () => {
  for (let n = 0; n < 60; n++) {
    now += 500;
    expect(
      (await call(n % 2 ? "PUT" : "DELETE", card, n % 2 ? {} : undefined))
        .status,
    ).toBe(n % 2 ? 200 : 204);
  }
  const before = await rows();
  expect((await call("DELETE")).status).toBe(429);
  expect(await rows()).toEqual(before);
  expect((await call()).status).toBe(200);
  expect((await call("PUT", card, {}, tokens.other)).status).toBe(200);
  now += 30000;
  expect((await call("DELETE")).status).toBe(429);
  now += 500;
  expect((await call("DELETE")).status).toBe(204);
});
test("enforces the quota across concurrent requests", async () => {
  const responses = await Promise.all(
    Array.from({ length: 65 }, () => call("PUT", card, {})),
  );
  expect(responses.filter((response) => response.status === 200)).toHaveLength(
    60,
  );
  expect(responses.filter((response) => response.status === 429)).toHaveLength(
    5,
  );
});

// The deployed Worker and real registry run inside workerd here; the
// alias/exclusion cases above use the Vitest registry fixture.
test("serves records through the bundled Worker with local D1", async () => {
  const headers = {
    Origin: (await running.worker.getEnv()).ALLOWED_ORIGIN,
    "Content-Type": "application/json",
    Cookie: "__Host-session=" + tokens.normal,
  };
  const response = await running.harness.fetch("/api/me/records/" + card, {
    method: "PUT",
    headers,
    body: JSON.stringify({ memo: "runtime memo", receivedOn: "2024-02-29" }),
  });
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({
    cardId: card,
    memo: "runtime memo",
    receivedOn: "2024-02-29",
  });
  const list = await running.harness.fetch("/api/me/records", { headers });
  expect(list.headers.get("Cache-Control")).toBe("private, no-store");
  expect(await list.json()).toEqual([
    { cardId: card, receivedOn: "2024-02-29" },
  ]);
});

test("removes quota rows when an account is deleted", async () => {
  expect((await call("PUT", card, {}, tokens.other)).status).toBe(200);
  await env.DB!.prepare("DELETE FROM users WHERE id = 'two'").run();
  expect(
    (await env
      .DB!.prepare(
        "SELECT count(*) AS n FROM records_write_events WHERE user_id = 'two'",
      )
      .first<{ n: number }>())!.n,
  ).toBe(0);
  await env.DB!.prepare("INSERT INTO users VALUES ('two', 'Two', 0)").run();
});
