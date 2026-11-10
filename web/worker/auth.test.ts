import { createHash } from "node:crypto";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from "vitest";
import { createApp } from "./app";
import type { D1Database, Env } from "./env";
import { reconcile } from "../scripts/reconcile-tombstones.mjs";
import { routes } from "./routes";
import { Authenticator, UP, UV } from "./test-authenticator";
import { startWorker } from "./test-harness";

const origin = "https://manhole-techo.com";
const rpId = "manhole-techo.com";
const MINUTE = 60 * 1000;

let running: Awaited<ReturnType<typeof startWorker>>;
let env: Env;
let db: D1Database;
let tombstones: D1Database;
let now = 0;
const logs: string[] = [];
const app = createApp({
  routes,
  clock: () => now,
  log: (line) => logs.push(line),
});
beforeAll(async () => {
  running = await startWorker({ dev: true });
  const local = await running.worker.getEnv();
  env = { ...local, ALLOWED_ORIGIN: origin, RP_ID: rpId };
  db = local.DB;
  tombstones = local.TOMBSTONES;
});
afterAll(() => running.close());
const userTables = [
  "sessions",
  "credentials",
  "recovery_codes",
  "records",
  "records_write_events",
  "rate_limits",
  "invites",
  "friend_requests",
  "friendships",
  "blocks",
  "users",
  "used_challenges",
  "recovery_failures",
];
beforeEach(async () => {
  now = Date.UTC(2026, 10, 10, 3);
  logs.length = 0;
  await db.batch(userTables.map((table) => db.prepare("DELETE FROM " + table)));
  await tombstones.prepare("DELETE FROM tombstones").run();
});

type Body = Record<string, any>;

// One browser: keeps the session cookie between calls like a cookie jar.
class Client {
  cookie = "";
  readonly authenticator = new Authenticator();
  // Every challenge the server handed this client.
  readonly challenges: string[] = [];

  async call(
    method: string,
    path: string,
    body?: unknown,
    headers: Record<string, string> = {},
  ) {
    const response = await app(
      new Request(origin + path, {
        method,
        ...(body !== undefined && { body: JSON.stringify(body) }),
        headers: {
          ...(method !== "GET" && { Origin: origin }),
          ...(body !== undefined && { "Content-Type": "application/json" }),
          ...(this.cookie && { Cookie: "__Host-session=" + this.cookie }),
          ...headers,
        },
      }),
      env,
    );
    for (const cookie of response.headers.getSetCookie())
      if (cookie.startsWith("__Host-session="))
        this.cookie = cookie.split(";")[0]!.slice("__Host-session=".length);
    const json = (await response.json()) as Body;
    if (typeof json.challenge === "string")
      this.challenges.push(json.challenge);
    return { status: response.status, body: json, response };
  }

  async signUp(displayName = "マンホール好き", alg?: -7 | -8 | -257) {
    const options = await this.call("POST", "/api/auth/register/options", {
      displayName,
    });
    expect(options.status).toBe(200);
    const credential = await this.authenticator.register(options.body, {
      origin,
      rpId,
      ...(alg && { alg }),
    });
    const verified = await this.call("POST", "/api/auth/register/verify", {
      displayName,
      response: credential,
    });
    expect(verified.status).toBe(200);
    return verified.body;
  }

  async login(overrides: Parameters<Authenticator["login"]>[1] | {} = {}) {
    const options = await this.call("POST", "/api/auth/login/options");
    const response = await this.authenticator.login(options.body, {
      origin,
      rpId,
      ...overrides,
    });
    return this.call("POST", "/api/auth/login/verify", { response });
  }

  async reauth() {
    const options = await this.call("POST", "/api/auth/reauth/options");
    expect(options.status).toBe(200);
    const response = await this.authenticator.login(options.body, {
      origin,
      rpId,
    });
    return this.call("POST", "/api/auth/reauth/verify", { response });
  }

  async addPasskey(alg?: -7 | -8 | -257) {
    const options = await this.call("POST", "/api/passkeys/register/options");
    if (options.status !== 200) return options;
    const response = await this.authenticator.register(options.body, {
      origin,
      rpId,
      ...(alg && { alg }),
    });
    return this.call("POST", "/api/passkeys/register/verify", { response });
  }

  async userId() {
    const row = await db
      .prepare("SELECT user_id FROM sessions WHERE token_hash = ?")
      .bind(createHash("sha256").update(this.cookie).digest("hex"))
      .first<{ user_id: string }>();
    return row!.user_id;
  }
}

const all = async (sql: string, ...values: unknown[]) =>
  (
    await db
      .prepare(sql)
      .bind(...values)
      .all<Record<string, any>>()
  ).results;
// Every table, so a table added later is checked for leftovers too.
const dump = async () => {
  const tables = await all(
    "SELECT name FROM sqlite_schema WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name <> 'd1_migrations'",
  );
  const rows: unknown[] = [];
  for (const { name } of tables)
    rows.push(...(await all("SELECT * FROM " + name)));
  return JSON.stringify(rows);
};

describe("registration", () => {
  test("offers discoverable, verified passkeys without the display name", async () => {
    const client = new Client();
    const { status, body } = await client.call(
      "POST",
      "/api/auth/register/options",
      { displayName: "マンホール好き" },
    );
    expect(status).toBe(200);
    expect(body.rp).toEqual({ id: rpId, name: "マンホール手帳" });
    expect(body.user.name).toBe("マンホール手帳 2026-11-10");
    expect(body.user.displayName).toBe("マンホール手帳 2026-11-10");
    expect(Buffer.from(body.user.id, "base64url").length).toBeLessThanOrEqual(
      64,
    );
    expect(body.authenticatorSelection).toMatchObject({
      residentKey: "required",
      userVerification: "required",
    });
    expect(body.attestation).toBe("none");
    expect(body.pubKeyCredParams.map((param: Body) => param.alg)).toEqual([
      -8, -7, -257,
    ]);
    expect(Buffer.from(body.challenge, "base64url")).toHaveLength(90);
    expect(body.timeout).toBe(5 * MINUTE);
  });

  test("creates the account, a session and ten recovery codes", async () => {
    const client = new Client();
    const body = await client.signUp();
    expect(body.displayName).toBe("マンホール好き");
    expect(body.passkeys).toBe(1);
    expect(body.recoveryCodesRemaining).toBe(10);
    expect(body.recoveryCodes).toHaveLength(10);
    for (const code of body.recoveryCodes)
      expect(code).toMatch(
        /^[0-9A-HJKMNP-TV-Z]{4}(-[0-9A-HJKMNP-TV-Z]{4}){3}$/,
      );
    expect(new Set(body.recoveryCodes).size).toBe(10);
    expect(await all("SELECT kind FROM sessions")).toEqual([
      { kind: "normal" },
    ]);
    expect(await all("SELECT * FROM used_challenges")).toHaveLength(1);
    // The plain codes and the session token are only in the response.
    const stored = await dump();
    for (const code of body.recoveryCodes) {
      expect(stored).not.toContain(code);
      expect(stored).not.toContain(code.replaceAll("-", ""));
    }
    expect(stored).not.toContain(client.cookie);
    const me = await client.call("GET", "/api/me");
    expect(me.body).toEqual({
      displayName: "マンホール好き",
      passkeys: 1,
      recoveryCodesRemaining: 10,
    });
    const [credential] = await all("SELECT label, user_id FROM credentials");
    expect(credential).toEqual({
      label: "パスキー 1",
      user_id: await client.userId(),
    });
  });

  test.each([
    ["empty", ""],
    ["only spaces", "　 "],
    ["21 graphemes", "あ".repeat(21)],
    ["a newline", "a\nb"],
    ["a tab", "a\tb"],
    ["a control character", "a\u0007"],
    ["a bidi override", "a\u202Eb"],
    ["a bidi isolate", "a\u2067b"],
    ["a line separator", "a\u2028b"],
    ["a lone surrogate", "a\uD800"],
    ["a number", 1],
  ])("rejects a display name with %s", async (_, displayName) => {
    const client = new Client();
    const { status, body } = await client.call(
      "POST",
      "/api/auth/register/options",
      { displayName },
    );
    expect(status).toBe(400);
    expect(body).toEqual({ error: "invalid_display_name" });
  });

  test.each([
    ["20 graphemes", "あ".repeat(20), "あ".repeat(20)],
    [
      "ZWJ emoji counted as one",
      "👨\u200D👩\u200D👧\u200D👦".repeat(20),
      "👨\u200D👩\u200D👧\u200D👦".repeat(20),
    ],
    ["surrounding spaces", "  たろう　", "たろう"],
    ["a decomposed accent", "Cafe\u0301", "Café"],
  ])("accepts a display name with %s", async (_, input, stored) => {
    const client = new Client();
    await client.signUp(input);
    expect((await client.call("GET", "/api/me")).body.displayName).toBe(stored);
  });

  const breakRegistration = async (
    overrides: Partial<Parameters<Authenticator["register"]>[1]>,
    before?: () => void,
  ) => {
    const client = new Client();
    const options = await client.call("POST", "/api/auth/register/options", {
      displayName: "a",
    });
    const response = await client.authenticator.register(options.body, {
      origin,
      rpId,
      ...overrides,
    });
    before?.();
    const result = await client.call("POST", "/api/auth/register/verify", {
      displayName: "a",
      response,
    });
    expect(result.status).toBe(400);
    expect(await all("SELECT * FROM users")).toEqual([]);
    expect(client.cookie).toBe("");
    return result;
  };
  test.each([
    ["another origin", { origin: "https://evil.example" }],
    ["a subdomain origin", { origin: "https://pr-1.manhole-techo.com" }],
    ["another RP ID", { rpId: "evil.example" }],
    ["no user verification", { flags: UP }],
    ["no user presence", { flags: UV }],
    ["the login type", { type: "webauthn.get" }],
    [
      "an unknown challenge",
      { challenge: Buffer.alloc(32).toString("base64url") },
    ],
  ])("rejects a registration with %s", async (_, overrides) => {
    await breakRegistration(overrides);
  });
  test("rejects a registration after five minutes", async () => {
    await breakRegistration({}, () => {
      now += 5 * MINUTE;
    });
  });

  test("consumes the challenge once", async () => {
    const client = new Client();
    const options = await client.call("POST", "/api/auth/register/options", {
      displayName: "a",
    });
    const response = await client.authenticator.register(options.body, {
      origin,
      rpId,
    });
    const verify = () =>
      new Client().call("POST", "/api/auth/register/verify", {
        displayName: "a",
        response,
      });
    expect((await verify()).status).toBe(200);
    expect((await verify()).status).toBe(400);
    expect(await all("SELECT id FROM users")).toHaveLength(1);
  });

  test("rejects a login challenge for a registration", async () => {
    const client = new Client();
    const login = await client.call("POST", "/api/auth/login/options");
    const response = await client.authenticator.register(
      { challenge: login.body.challenge, user: { id: "AAAA" } },
      { origin, rpId },
    );
    const result = await client.call("POST", "/api/auth/register/verify", {
      displayName: "a",
      response,
    });
    expect(result.status).toBe(400);
  });

  test("answers 400, not 500, for a malformed response", async () => {
    const client = new Client();
    for (const response of [undefined, "x", {}, { response: {} }]) {
      const result = await client.call("POST", "/api/auth/register/verify", {
        displayName: "a",
        response,
      });
      expect(result.status).toBe(400);
    }
  });
});

describe("login", () => {
  test("offers a discoverable login with user verification", async () => {
    const { body } = await new Client().call("POST", "/api/auth/login/options");
    expect(body.rpId).toBe(rpId);
    expect(body.userVerification).toBe("required");
    expect(body.allowCredentials ?? []).toEqual([]);
    expect(Buffer.from(body.challenge, "base64url")).toHaveLength(90);
  });

  test("starts a new session that replaces a planted cookie", async () => {
    const client = new Client();
    await client.signUp();
    const planted = client.cookie;
    const result = await client.login();
    expect(result.status).toBe(200);
    expect(result.body.displayName).toBe("マンホール好き");
    expect(client.cookie).not.toBe(planted);
    expect(await all("SELECT * FROM sessions")).toHaveLength(1);
    const [credential] = await all("SELECT last_used_at FROM credentials");
    expect(credential!.last_used_at).toBe(now);
  });

  test("accepts a zero counter and only logs a decrease", async () => {
    const client = new Client();
    await client.signUp();
    expect((await client.login({ counter: 0 })).status).toBe(200);
    expect((await client.login({ counter: 5 })).status).toBe(200);
    expect(
      (await all("SELECT sign_count FROM credentials"))[0]!.sign_count,
    ).toBe(5);
    logs.length = 0;
    expect((await client.login({ counter: 3 })).status).toBe(200);
    expect(
      logs.some((line) =>
        JSON.parse(line).events?.includes("sign_count_not_increased"),
      ),
    ).toBe(true);
    expect(
      (await all("SELECT sign_count FROM credentials"))[0]!.sign_count,
    ).toBe(5);
  });

  test.each([
    ["a tampered client data", { tamper: true }],
    ["another origin", { origin: "https://evil.example" }],
    ["another RP ID", { rpId: "evil.example" }],
    ["no user verification", { flags: UP }],
    ["the registration type", { type: "webauthn.create" }],
    [
      "an unknown challenge",
      { challenge: Buffer.alloc(32).toString("base64url") },
    ],
  ])("rejects a login with %s", async (_, overrides) => {
    const client = new Client();
    await client.signUp();
    const result = await client.login(overrides);
    expect(result.status).toBe(400);
    expect(await all("SELECT * FROM sessions")).toHaveLength(1);
  });

  test("rejects a login after five minutes and on reuse", async () => {
    const client = new Client();
    await client.signUp();
    const options = await client.call("POST", "/api/auth/login/options");
    const response = await client.authenticator.login(options.body, {
      origin,
      rpId,
    });
    now += 5 * MINUTE;
    expect(
      (await client.call("POST", "/api/auth/login/verify", { response }))
        .status,
    ).toBe(400);
    const fresh = await client.call("POST", "/api/auth/login/options");
    const again = await client.authenticator.login(fresh.body, {
      origin,
      rpId,
    });
    expect(
      (await client.call("POST", "/api/auth/login/verify", { response: again }))
        .status,
    ).toBe(200);
    expect(
      (await client.call("POST", "/api/auth/login/verify", { response: again }))
        .status,
    ).toBe(400);
  });

  test("rejects a credential presented for another user", async () => {
    const alice = new Client();
    const bob = new Client();
    await alice.signUp("alice");
    await bob.signUp("bob");
    const bobHandle = bob.authenticator.credentials[0]!.userHandle;
    const result = await alice.login({ userHandle: bobHandle });
    expect(result.status).toBe(400);
  });

  test("rejects an unknown credential", async () => {
    const client = new Client();
    await client.signUp();
    await db.prepare("DELETE FROM credentials").run();
    expect((await client.login()).status).toBe(400);
  });

  test.each([-8, -257] as const)(
    "registers and logs in with alg %i",
    async (alg) => {
      const client = new Client();
      await client.signUp("a", alg);
      expect((await client.login()).status).toBe(200);
    },
  );
});

describe("logout", () => {
  test("ends the session and clears the cookies", async () => {
    const client = new Client();
    await client.signUp();
    const token = client.cookie;
    const result = await client.call("POST", "/api/auth/logout");
    expect(result.status).toBe(200);
    expect(result.response.headers.getSetCookie()).toEqual([
      "__Host-session=; Max-Age=0; Path=/; Secure; HttpOnly; SameSite=Lax",
      "signed_in=; Max-Age=0; Path=/; Secure; SameSite=Lax",
    ]);
    expect(await all("SELECT * FROM sessions")).toEqual([]);
    client.cookie = token;
    expect((await client.call("GET", "/api/me")).status).toBe(401);
  });
});

describe("recovery", () => {
  const recover = (client: Client, code: unknown) =>
    client.call("POST", "/api/auth/recover", { code });

  test("allows only passkey registration in a recovery session", async () => {
    const owner = new Client();
    const { recoveryCodes } = await owner.signUp();
    const client = new Client();
    const result = await recover(
      client,
      recoveryCodes[0].toLowerCase().replaceAll("-", " "),
    );
    expect(result.status).toBe(200);
    expect(result.response.headers.getSetCookie()).toContain(
      "signed_in=; Max-Age=0; Path=/; Secure; SameSite=Lax",
    );
    for (const [method, path, body] of [
      ["GET", "/api/me"],
      ["PATCH", "/api/me", { displayName: "x" }],
      ["DELETE", "/api/me"],
      ["GET", "/api/passkeys"],
      ["PATCH", "/api/passkeys/x", { label: "x" }],
      ["DELETE", "/api/passkeys/x"],
      ["GET", "/api/me/records"],
      ["GET", "/api/me/records/13-100-A001"],
      ["PUT", "/api/me/records/13-100-A001", {}],
      ["DELETE", "/api/me/records/13-100-A001"],
      ["GET", "/api/recovery-codes"],
      ["POST", "/api/recovery-codes"],
      ["POST", "/api/auth/reauth/options"],
      ["POST", "/api/auth/reauth/verify", { response: {} }],
    ] as const) {
      const denied = await client.call(method, path, body);
      expect(denied.status, method + " " + path).toBe(403);
      expect(denied.body).toEqual({ error: "recovery_session" });
    }
    // Registering a passkey turns it into a normal, freshly verified session
    // and ends every other session, including the owner's.
    const added = await client.addPasskey();
    expect(added.status).toBe(200);
    expect(added.response.headers.getSetCookie()).toContain(
      "signed_in=1; Max-Age=2592000; Path=/; Secure; SameSite=Lax",
    );
    expect(await all("SELECT kind, verified_at FROM sessions")).toEqual([
      { kind: "normal", verified_at: now },
    ]);
    expect((await owner.call("GET", "/api/me")).status).toBe(401);
    const passkeys = (await client.call("GET", "/api/passkeys")).body.passkeys;
    expect(passkeys).toHaveLength(2);
    // The old, possibly leaked passkey can be removed without another prompt.
    const removed = await client.call(
      "DELETE",
      "/api/passkeys/" + passkeys[0].id,
    );
    expect(removed.status).toBe(200);
  });

  test("ends a recovery session after 15 minutes", async () => {
    const { recoveryCodes } = await new Client().signUp();
    const client = new Client();
    await recover(client, recoveryCodes[0]);
    now += 15 * MINUTE;
    expect(
      (await client.call("POST", "/api/passkeys/register/options")).status,
    ).toBe(401);
  });

  test("uses each code once, even concurrently", async () => {
    const { recoveryCodes } = await new Client().signUp();
    const results = await Promise.all(
      Array.from({ length: 5 }, () => recover(new Client(), recoveryCodes[1])),
    );
    expect(results.map((result) => result.status).sort()).toEqual([
      200, 400, 400, 400, 400,
    ]);
    expect((await recover(new Client(), recoveryCodes[1])).status).toBe(400);
    expect((await recover(new Client(), recoveryCodes[2])).status).toBe(200);
  });

  test("rejects codes from before a reissue", async () => {
    const client = new Client();
    const { recoveryCodes: old } = await client.signUp();
    const reissued = await client.call("POST", "/api/recovery-codes");
    expect(reissued.status).toBe(200);
    expect(reissued.body.recoveryCodes).toHaveLength(10);
    expect((await client.call("GET", "/api/recovery-codes")).body).toEqual({
      remaining: 10,
    });
    for (const code of old)
      expect((await recover(new Client(), code)).status).toBe(400);
    expect(
      (await recover(new Client(), reissued.body.recoveryCodes[0])).status,
    ).toBe(200);
    expect((await client.call("GET", "/api/recovery-codes")).body).toEqual({
      remaining: 9,
    });
    const stored = await dump();
    for (const code of reissued.body.recoveryCodes)
      expect(stored).not.toContain(code.replaceAll("-", ""));
  });

  test.each([undefined, "", "short", "I".repeat(16) + "U", 12])(
    "rejects a malformed code %j",
    async (code) => {
      const result = await recover(new Client(), code);
      expect(result.status).toBe(400);
      expect(result.body).toEqual({ error: "invalid_code" });
    },
  );

  test("pauses recovery for the rest of a window after many failures", async () => {
    const { recoveryCodes } = await new Client().signUp();
    now = Math.ceil(now / (10 * MINUTE)) * 10 * MINUTE;
    for (let attempt = 0; attempt < 100; attempt++)
      expect((await recover(new Client(), "0000-0000-0000-0000")).status).toBe(
        400,
      );
    const paused = await recover(new Client(), recoveryCodes[0]);
    expect(paused.status).toBe(429);
    expect(paused.body).toEqual({ error: "recovery_paused" });
    expect(paused.response.headers.get("Retry-After")).toBe("600");
    now += 10 * MINUTE - 1;
    expect((await recover(new Client(), recoveryCodes[0])).status).toBe(429);
    now += 1;
    expect((await recover(new Client(), recoveryCodes[0])).status).toBe(200);
    expect(await all("SELECT bucket FROM recovery_failures")).toEqual([]);
  });

  test("asks the rate limiter by IP first when it is bound", async () => {
    const keys: string[] = [];
    const saved = env;
    env = {
      ...saved,
      RECOVERY_LIMITER: {
        limit: async ({ key }) => {
          keys.push(key);
          return { success: keys.length < 2 };
        },
      },
    };
    try {
      const headers = { "CF-Connecting-IP": "203.0.113.9" };
      expect(
        (
          await new Client().call(
            "POST",
            "/api/auth/recover",
            { code: "x" },
            headers,
          )
        ).status,
      ).toBe(400);
      const limited = await new Client().call(
        "POST",
        "/api/auth/recover",
        { code: "x" },
        headers,
      );
      expect(limited.status).toBe(429);
      expect(keys).toEqual(["203.0.113.9", "203.0.113.9"]);
      expect(await all("SELECT failures FROM recovery_failures")).toEqual([
        { failures: 1 },
      ]);
    } finally {
      env = saved;
    }
  });
});

describe("reauthentication", () => {
  test.each([
    ["DELETE", "/api/passkeys/first"],
    ["POST", "/api/recovery-codes"],
    ["DELETE", "/api/me"],
  ] as const)(
    "requires a passkey within five minutes for %s %s",
    async (method, path) => {
      const client = new Client();
      await client.signUp();
      expect((await client.addPasskey()).status).toBe(200);
      const first = client.authenticator.credentials[0]!.id;
      const target = path.replace("first", first);
      now += 5 * MINUTE + 1;
      const denied = await client.call(method, target);
      expect(denied.status).toBe(403);
      expect(denied.body).toEqual({ error: "reauth_required" });
      expect((await client.reauth()).status).toBe(200);
      expect(await all("SELECT verified_at FROM sessions")).toEqual([
        { verified_at: now },
      ]);
      expect((await client.call(method, target)).status).toBe(200);
    },
  );

  test("lists only the user's passkeys and rejects another user's", async () => {
    const alice = new Client();
    const bob = new Client();
    await alice.signUp("alice");
    await bob.signUp("bob");
    const options = await alice.call("POST", "/api/auth/reauth/options");
    expect(options.body.allowCredentials.map((item: Body) => item.id)).toEqual([
      alice.authenticator.credentials[0]!.id,
    ]);
    const response = await bob.authenticator.login(options.body, {
      origin,
      rpId,
    });
    expect(
      (await alice.call("POST", "/api/auth/reauth/verify", { response }))
        .status,
    ).toBe(400);
    // Bob cannot spend Alice's challenge either.
    const stolen = await bob.authenticator.login(
      (await alice.call("POST", "/api/auth/reauth/options")).body,
      { origin, rpId },
    );
    expect(
      (await bob.call("POST", "/api/auth/reauth/verify", { response: stolen }))
        .status,
    ).toBe(400);
  });

  test("rejects a reauthentication without user verification", async () => {
    const client = new Client();
    await client.signUp();
    const options = await client.call("POST", "/api/auth/reauth/options");
    const response = await client.authenticator.login(options.body, {
      origin,
      rpId,
      flags: UP,
    });
    expect(
      (await client.call("POST", "/api/auth/reauth/verify", { response }))
        .status,
    ).toBe(400);
  });
});

describe("passkeys", () => {
  test("adds up to ten, excluding registered ones", async () => {
    const client = new Client();
    await client.signUp();
    const options = await client.call("POST", "/api/passkeys/register/options");
    expect(
      options.body.excludeCredentials.map((item: Body) => item.id),
    ).toEqual([client.authenticator.credentials[0]!.id]);
    expect(options.body.user.id).toBe(
      client.authenticator.credentials[0]!.userHandle,
    );
    for (let count = 2; count <= 10; count++)
      expect((await client.addPasskey()).status).toBe(200);
    const full = await client.call("POST", "/api/passkeys/register/options");
    expect(full.status).toBe(409);
    expect(full.body).toEqual({ error: "passkey_limit" });
    const { body } = await client.call("GET", "/api/passkeys");
    expect(body.passkeys).toHaveLength(10);
    expect(body.passkeys[9]).toEqual({
      id: client.authenticator.credentials[9]!.id,
      label: "パスキー 10",
      createdAt: now,
      lastUsedAt: null,
    });
  });

  test("refuses an eleventh passkey even with an earlier challenge", async () => {
    const client = new Client();
    await client.signUp();
    for (let count = 2; count <= 9; count++) await client.addPasskey();
    const early = await client.call("POST", "/api/passkeys/register/options");
    expect((await client.addPasskey()).status).toBe(200);
    const response = await client.authenticator.register(early.body, {
      origin,
      rpId,
    });
    const late = await client.call("POST", "/api/passkeys/register/verify", {
      response,
    });
    expect(late.status).toBe(409);
    expect(await all("SELECT id FROM credentials")).toHaveLength(10);
  });

  test("renames with a label of 1 to 30 characters", async () => {
    const client = new Client();
    await client.signUp();
    const id = client.authenticator.credentials[0]!.id;
    for (const label of ["", "a".repeat(31), "a\nb"])
      expect(
        (await client.call("PATCH", "/api/passkeys/" + id, { label })).status,
      ).toBe(400);
    const renamed = await client.call("PATCH", "/api/passkeys/" + id, {
      label: " " + "あ".repeat(30) + " ",
    });
    expect(renamed.status).toBe(200);
    expect(
      (await client.call("GET", "/api/passkeys")).body.passkeys[0].label,
    ).toBe("あ".repeat(30));
  });

  test("keeps the last passkey and records deletions", async () => {
    const client = new Client();
    await client.signUp();
    const [first] = client.authenticator.credentials;
    const last = await client.call("DELETE", "/api/passkeys/" + first!.id);
    expect(last.status).toBe(409);
    expect(last.body).toEqual({ error: "last_passkey" });
    await client.addPasskey();
    expect(
      (await client.call("DELETE", "/api/passkeys/" + first!.id)).status,
    ).toBe(200);
    expect(await all("SELECT id FROM credentials")).toEqual([
      { id: client.authenticator.credentials[1]!.id },
    ]);
    const recorded = await tombstones
      .prepare("SELECT kind, subject, created_at FROM tombstones")
      .all();
    expect(recorded.results).toEqual([
      { kind: "credential", subject: first!.id, created_at: now },
    ]);
    expect((await client.login({ credential: first })).status).toBe(400);
  });

  test("does not touch another user's passkeys", async () => {
    const alice = new Client();
    const bob = new Client();
    await alice.signUp("alice");
    await bob.signUp("bob");
    await bob.addPasskey();
    const target = "/api/passkeys/" + bob.authenticator.credentials[0]!.id;
    expect((await alice.call("PATCH", target, { label: "x" })).status).toBe(
      404,
    );
    await alice.addPasskey();
    expect((await alice.call("DELETE", target)).status).toBe(404);
    expect(await all("SELECT id FROM credentials")).toHaveLength(4);
  });

  test("refuses to register the same credential twice", async () => {
    const client = new Client();
    await client.signUp();
    const options = await client.call("POST", "/api/passkeys/register/options");
    const response = await client.authenticator.register(options.body, {
      origin,
      rpId,
    });
    // Another account already holds this credential ID.
    const other = new Client();
    await other.signUp("other");
    await db
      .prepare("UPDATE credentials SET id = ? WHERE user_id = ?")
      .bind(response.id, await other.userId())
      .run();
    const result = await client.call("POST", "/api/passkeys/register/verify", {
      response,
    });
    expect(result.status).toBe(400);
    expect(
      await all("SELECT user_id FROM credentials WHERE id = ?", response.id),
    ).toEqual([{ user_id: await other.userId() }]);
  });
});

describe("account", () => {
  test("changes the display name", async () => {
    const client = new Client();
    await client.signUp();
    expect(
      (await client.call("PATCH", "/api/me", { displayName: "\u202E" })).status,
    ).toBe(400);
    const changed = await client.call("PATCH", "/api/me", {
      displayName: " 新しい名前 ",
    });
    expect(changed.status).toBe(200);
    expect(changed.body.displayName).toBe("新しい名前");
  });

  test("deletes every row of the account and records the deletion", async () => {
    const client = new Client();
    const other = new Client();
    await client.signUp("me");
    await other.signUp("other");
    const id = await client.userId();
    const otherId = await other.userId();
    const [a, b] = [id, otherId].sort();
    await db.batch([
      db
        .prepare(
          "INSERT INTO records (user_id, card_id, updated_at) VALUES (?, 'c', 1)",
        )
        .bind(id),
      db
        .prepare(
          "INSERT INTO records_write_events (id, user_id, written_at) VALUES ('e1', ?, 1)",
        )
        .bind(id),
      db
        .prepare(
          "INSERT INTO records (user_id, card_id, updated_at) VALUES (?, 'c', 1)",
        )
        .bind(otherId),
      db
        .prepare(
          "INSERT INTO invites (user_id, token_hash, expires_at) VALUES (?, 'i', 1)",
        )
        .bind(id),
      db
        .prepare(
          "INSERT INTO friend_requests (from_user_id, to_user_id, created_at) VALUES (?, ?, 1)",
        )
        .bind(otherId, id),
      db
        .prepare(
          "INSERT INTO friendships (user_a, user_b, created_at) VALUES (?, ?, 1)",
        )
        .bind(a, b),
      db
        .prepare(
          "INSERT INTO blocks (blocker_id, blocked_id, created_at) VALUES (?, ?, 1)",
        )
        .bind(otherId, id),
    ]);
    await client.call("POST", "/api/auth/reauth/options");
    const deleted = await client.call("DELETE", "/api/me");
    expect(deleted.status).toBe(200);
    expect(deleted.response.headers.getSetCookie()).toContain(
      "__Host-session=; Max-Age=0; Path=/; Secure; HttpOnly; SameSite=Lax",
    );
    expect(await dump()).not.toContain(id);
    expect(await all("SELECT user_id FROM records")).toEqual([
      { user_id: otherId },
    ]);
    expect((await other.call("GET", "/api/me")).status).toBe(200);
    const recorded = await tombstones
      .prepare("SELECT kind, subject, created_at FROM tombstones")
      .all();
    expect(recorded.results).toEqual([
      { kind: "account", subject: id, created_at: now },
    ]);
    expect((await client.call("GET", "/api/me")).status).toBe(401);
    expect((await client.login()).status).toBe(400);
  });

  test("keeps the account when the deletion cannot be recorded", async () => {
    const client = new Client();
    await client.signUp();
    const saved = env;
    env = {
      ...saved,
      TOMBSTONES: {
        prepare: () => {
          throw new Error("unavailable");
        },
        batch: () => Promise.reject(new Error("unavailable")),
      },
    };
    try {
      expect((await client.call("DELETE", "/api/me")).status).toBe(500);
    } finally {
      env = saved;
    }
    expect(await all("SELECT id FROM users")).toHaveLength(1);
  });
});

test("forbids every state change from another origin", async () => {
  const client = new Client();
  await client.signUp();
  for (const [method, path] of [
    ["POST", "/api/auth/register/options"],
    ["POST", "/api/auth/register/verify"],
    ["POST", "/api/auth/login/options"],
    ["POST", "/api/auth/login/verify"],
    ["POST", "/api/auth/logout"],
    ["POST", "/api/auth/recover"],
    ["POST", "/api/auth/reauth/options"],
    ["POST", "/api/passkeys/register/options"],
    ["PATCH", "/api/passkeys/x"],
    ["DELETE", "/api/passkeys/x"],
    ["POST", "/api/recovery-codes"],
    ["PATCH", "/api/me"],
    ["DELETE", "/api/me"],
  ] as const) {
    for (const headers of [
      { Origin: "https://evil.example" },
      { Origin: "" },
    ]) {
      const result = await client.call(method, path, {}, headers);
      expect(result.status, method + " " + path).toBe(403);
    }
  }
  expect(await all("SELECT id FROM users")).toHaveLength(1);
});

test("keeps secrets and names out of the logs", async () => {
  const client = new Client();
  const { recoveryCodes } = await client.signUp("ログに出ない名前");
  const registerToken = client.cookie;
  await client.call("POST", "/api/auth/logout");
  await client.login();
  await client.call("PATCH", "/api/me", { displayName: "変更後の名前" });
  const { body } = await client.call("POST", "/api/recovery-codes");
  await client.call("POST", "/api/auth/recover", { code: recoveryCodes[0] });
  await client.call("POST", "/api/auth/recover", {
    code: body.recoveryCodes[0],
  });
  const { challenges } = client;
  const text = logs.join("\n");
  expect(logs.length).toBeGreaterThan(5);
  for (const secret of [
    ...recoveryCodes,
    ...body.recoveryCodes,
    ...recoveryCodes.map((code: string) => code.replaceAll("-", "")),
    registerToken,
    client.cookie,
    "ログに出ない名前",
    "変更後の名前",
    client.authenticator.credentials[0]!.id,
    ...challenges,
  ])
    expect(text).not.toContain(secret);
  for (const line of logs)
    expect(
      Object.keys(JSON.parse(line)).every((key) =>
        ["route", "status", "ms", "error", "user", "events"].includes(key),
      ),
    ).toBe(true);
});

// Wraps a binding so chosen statements fail, to test partial failures.
const failing = (
  database: D1Database,
  {
    sql = /$^/,
    batch = false,
    before,
  }: { sql?: RegExp; batch?: boolean; before?: () => Promise<unknown> },
): D1Database => ({
  prepare: (query) => {
    if (!sql.test(query)) return database.prepare(query);
    const fail = () => Promise.reject(new Error("injected"));
    const statement = {
      bind: () => statement,
      first: fail,
      all: fail,
      run: fail,
    };
    return statement;
  },
  batch: async (statements) => {
    await before?.();
    if (batch) throw new Error("injected");
    return database.batch(statements);
  },
});
const withEnv = async <T>(changes: Partial<Env>, run: () => Promise<T>) => {
  const saved = env;
  env = { ...saved, ...changes };
  try {
    return await run();
  } finally {
    env = saved;
  }
};
const tombstoneRows = async () =>
  (
    await tombstones
      .prepare("SELECT kind, subject, state FROM tombstones")
      .all()
  ).results;
// The restore tool, run against the same local databases.
const reconcileLocal = () =>
  reconcile({
    main: { all: async (sql) => (await db.prepare(sql).all()).results },
    tombstones: {
      all: async (sql) => (await tombstones.prepare(sql).all()).results,
    },
  });

describe("recovery promotion", () => {
  const recovering = async () => {
    const owner = new Client();
    const { recoveryCodes } = await owner.signUp();
    const client = new Client();
    await client.call("POST", "/api/auth/recover", { code: recoveryCodes[0] });
    return client;
  };
  const registration = async (client: Client) => {
    const options = await client.call("POST", "/api/passkeys/register/options");
    expect(options.status).toBe(200);
    return client.authenticator.register(options.body, { origin, rpId });
  };

  test("promotes once when two registrations race", async () => {
    const client = await recovering();
    const responses = [await registration(client), await registration(client)];
    const results = await Promise.all(
      responses.map((response) => {
        const racer = new Client();
        racer.cookie = client.cookie;
        return racer.call("POST", "/api/passkeys/register/verify", {
          response,
        });
      }),
    );
    expect(results.map((result) => result.status).sort()).toEqual([200, 401]);
    expect(await all("SELECT kind FROM sessions")).toEqual([
      { kind: "normal" },
    ]);
    expect(await all("SELECT id FROM credentials")).toHaveLength(2);
  });

  test("does not promote once the recovery session is gone", async () => {
    const client = await recovering();
    const response = await registration(client);
    // The session ends after the request was authorized.
    const result = await withEnv(
      {
        DB: failing(db, {
          before: () =>
            db.prepare("DELETE FROM sessions WHERE kind = 'recovery'").run(),
        }),
      },
      () => client.call("POST", "/api/passkeys/register/verify", { response }),
    );
    expect(result.status).toBe(401);
    // Only the owner's session from sign-up is left.
    expect(await all("SELECT kind FROM sessions")).toEqual([
      { kind: "normal" },
    ]);
    expect(await all("SELECT id FROM credentials")).toHaveLength(1);
  });

  test("recovers an account that already has ten passkeys", async () => {
    const owner = new Client();
    const { recoveryCodes } = await owner.signUp();
    for (let count = 2; count <= 10; count++) await owner.addPasskey();
    const client = new Client();
    await client.call("POST", "/api/auth/recover", { code: recoveryCodes[0] });
    expect((await client.addPasskey()).status).toBe(200);
    const { passkeys } = (await client.call("GET", "/api/passkeys")).body;
    expect(passkeys).toHaveLength(11);
    // Back to a normal session, the extra passkey can go.
    const removed = await client.call(
      "DELETE",
      "/api/passkeys/" + passkeys[0].id,
    );
    expect(removed.status).toBe(200);
    expect(
      (await client.call("POST", "/api/passkeys/register/options")).status,
    ).toBe(409);
  });
});

describe("deletion records", () => {
  test("marks the record done once the account is gone", async () => {
    const client = new Client();
    await client.signUp();
    const id = await client.userId();
    expect((await client.call("DELETE", "/api/me")).status).toBe(200);
    expect(await tombstoneRows()).toEqual([
      { kind: "account", subject: id, state: "done" },
    ]);
  });

  test("drops the record when the account deletion fails", async () => {
    const client = new Client();
    await client.signUp();
    const result = await withEnv({ DB: failing(db, { batch: true }) }, () =>
      client.call("DELETE", "/api/me"),
    );
    expect(result.status).toBe(500);
    expect(await all("SELECT id FROM users")).toHaveLength(1);
    expect(await tombstoneRows()).toEqual([]);
  });

  test("leaves a pending record that reconciliation removes", async () => {
    const client = new Client();
    await client.signUp();
    const result = await withEnv(
      {
        DB: failing(db, { batch: true }),
        TOMBSTONES: failing(tombstones, {
          sql: /^DELETE FROM tombstones WHERE id/,
        }),
      },
      () => client.call("DELETE", "/api/me"),
    );
    expect(result.status).toBe(500);
    expect((await tombstoneRows())[0]).toMatchObject({ state: "pending" });
    expect(await reconcileLocal()).toEqual({ done: 0, removed: 1, unknown: 0 });
    expect(await tombstoneRows()).toEqual([]);
    expect(await all("SELECT id FROM users")).toHaveLength(1);
  });

  test("leaves a pending record that reconciliation completes", async () => {
    const client = new Client();
    await client.signUp();
    const id = await client.userId();
    const result = await withEnv(
      { TOMBSTONES: failing(tombstones, { sql: /^UPDATE tombstones/ }) },
      () => client.call("DELETE", "/api/me"),
    );
    expect(result.status).toBe(200);
    expect(await tombstoneRows()).toEqual([
      { kind: "account", subject: id, state: "pending" },
    ]);
    expect(await reconcileLocal()).toEqual({ done: 1, removed: 0, unknown: 0 });
    expect(await tombstoneRows()).toEqual([
      { kind: "account", subject: id, state: "done" },
    ]);
  });

  test("drops the record when a passkey deletion fails", async () => {
    const client = new Client();
    await client.signUp();
    await client.addPasskey();
    const first = client.authenticator.credentials[0]!.id;
    const result = await withEnv(
      { DB: failing(db, { sql: /^DELETE FROM credentials/ }) },
      () => client.call("DELETE", "/api/passkeys/" + first),
    );
    expect(result.status).toBe(500);
    expect(await all("SELECT id FROM credentials")).toHaveLength(2);
    expect(await tombstoneRows()).toEqual([]);
  });

  test("reconciles a pending passkey record by whether the passkey exists", async () => {
    const client = new Client();
    await client.signUp();
    await client.addPasskey();
    const [first, second] = client.authenticator.credentials;
    await tombstones.batch([
      tombstones
        .prepare(
          "INSERT INTO tombstones (kind, subject, created_at, state) VALUES ('credential', ?, 1, 'pending')",
        )
        .bind(first!.id),
      tombstones.prepare(
        "INSERT INTO tombstones (kind, subject, created_at, state) VALUES ('credential', 'gone', 1, 'pending')",
      ),
      tombstones.prepare(
        "INSERT INTO tombstones (kind, subject, object, created_at, state) VALUES ('block', 'a', 'b', 1, 'pending')",
      ),
    ]);
    expect(await reconcileLocal()).toEqual({ done: 1, removed: 1, unknown: 1 });
    expect(await tombstoneRows()).toEqual([
      { kind: "credential", subject: "gone", state: "done" },
      { kind: "block", subject: "a", state: "pending" },
    ]);
    expect(second).toBeDefined();
  });
});

describe("stateless challenges", () => {
  test("issues options without writing to D1", async () => {
    const client = new Client();
    await client.signUp();
    const before = await dump();
    for (const path of [
      "/api/auth/register/options",
      "/api/auth/login/options",
      "/api/auth/reauth/options",
      "/api/passkeys/register/options",
    ]) {
      const result = await client.call("POST", path, { displayName: "a" });
      expect(result.status, path).toBe(200);
      expect(
        Buffer.from(result.body.challenge, "base64url").length,
      ).toBeGreaterThanOrEqual(32);
    }
    expect(await dump()).toBe(before);
  });

  test.each([
    [
      "a forged signature",
      (challenge: string) => {
        const bytes = Buffer.from(challenge, "base64url");
        bytes[bytes.length - 1]! ^= 1;
        return bytes.toString("base64url");
      },
    ],
    [
      "a changed expiry",
      (challenge: string) => {
        const bytes = Buffer.from(challenge, "base64url");
        bytes[5]! ^= 1;
        return bytes.toString("base64url");
      },
    ],
    ["a truncated challenge", (challenge: string) => challenge.slice(0, 43)],
  ])("rejects %s without writing to D1", async (_, change) => {
    const client = new Client();
    const options = await client.call("POST", "/api/auth/register/options", {
      displayName: "a",
    });
    const response = await client.authenticator.register(options.body, {
      origin,
      rpId,
      challenge: change(options.body.challenge),
    });
    const before = await dump();
    const result = await client.call("POST", "/api/auth/register/verify", {
      displayName: "a",
      response,
    });
    expect(result.status).toBe(400);
    expect(await dump()).toBe(before);
  });

  test("rejects an expired or failed ceremony without writing to D1", async () => {
    const client = new Client();
    await client.signUp();
    const options = await client.call("POST", "/api/auth/login/options");
    const unverified = await client.authenticator.login(options.body, {
      origin,
      rpId,
      flags: UP,
    });
    const before = await dump();
    expect(
      (
        await client.call("POST", "/api/auth/login/verify", {
          response: unverified,
        })
      ).status,
    ).toBe(400);
    const valid = await client.authenticator.login(options.body, {
      origin,
      rpId,
    });
    now += 5 * MINUTE;
    expect(
      (await client.call("POST", "/api/auth/login/verify", { response: valid }))
        .status,
    ).toBe(400);
    expect(await dump()).toBe(before);
  });

  test("accepts one of two copies of a response sent at once", async () => {
    const client = new Client();
    await client.signUp();
    const options = await client.call("POST", "/api/auth/login/options");
    const response = await client.authenticator.login(options.body, {
      origin,
      rpId,
    });
    const results = await Promise.all(
      [1, 2].map(() =>
        new Client().call("POST", "/api/auth/login/verify", { response }),
      ),
    );
    expect(results.map((result) => result.status).sort()).toEqual([200, 400]);
    expect(await all("SELECT kind FROM sessions")).toHaveLength(2);
  });

  test("limits new accounts to ten per ten minutes", async () => {
    now = Math.ceil(now / (10 * MINUTE)) * 10 * MINUTE;
    for (let count = 1; count <= 10; count++) await new Client().signUp();
    const client = new Client();
    const options = await client.call("POST", "/api/auth/register/options", {
      displayName: "a",
    });
    const response = await client.authenticator.register(options.body, {
      origin,
      rpId,
    });
    const before = await dump();
    const paused = await client.call("POST", "/api/auth/register/verify", {
      displayName: "a",
      response,
    });
    expect(paused.status).toBe(429);
    expect(paused.body).toEqual({ error: "registration_paused" });
    expect(await dump()).toBe(before);
    now += 10 * MINUTE;
    await new Client().signUp();
  });

  test("stops ceremonies when the challenge secret is missing", async () => {
    const result = await withEnv({ CHALLENGE_SECRET: "" }, () =>
      new Client().call("POST", "/api/auth/login/options"),
    );
    expect(result.status).toBe(503);
    expect(result.body).toEqual({ error: "auth_unavailable" });
  });
});
