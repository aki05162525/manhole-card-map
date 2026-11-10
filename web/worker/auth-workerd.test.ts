import { afterAll, beforeAll, expect, test } from "vitest";
import { Authenticator } from "./test-authenticator";
import { startWorker } from "./test-harness";

// The WebAuthn library and every signature algorithm run in workerd itself
// with the local settings of `wrangler dev --env dev` (TE-2).
const origin = "http://localhost:8787";
const rpId = "localhost";

let running: Awaited<ReturnType<typeof startWorker>>;
beforeAll(async () => {
  running = await startWorker({ dev: true });
});
afterAll(() => running.close());

const post = async (path: string, body: unknown, cookie = "") => {
  const response = await running.harness.fetch(path, {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      Origin: origin,
      "Content-Type": "application/json",
      ...(cookie && { Cookie: cookie }),
    },
  });
  const session = response.headers
    .getSetCookie()
    .find((value) => value.startsWith("__Host-session="));
  return {
    status: response.status,
    body: (await response.json()) as Record<string, any>,
    cookie: session?.split(";")[0] ?? cookie,
  };
};

test.each([-7, -8, -257] as const)(
  "registers, logs in and reauthenticates with alg %i",
  async (alg) => {
    const authenticator = new Authenticator();
    const options = await post("/api/auth/register/options", {
      displayName: "workerd",
    });
    expect(options.status).toBe(200);
    expect(options.body.rp.id).toBe(rpId);
    const registered = await post("/api/auth/register/verify", {
      displayName: "workerd",
      response: await authenticator.register(options.body, {
        origin,
        rpId,
        alg,
      }),
    });
    expect(registered.status).toBe(200);
    expect(registered.body.recoveryCodes).toHaveLength(10);
    const login = await post("/api/auth/login/options", {});
    const loggedIn = await post("/api/auth/login/verify", {
      response: await authenticator.login(login.body, { origin, rpId }),
    });
    expect(loggedIn.status).toBe(200);
    const reauth = await post("/api/auth/reauth/options", {}, loggedIn.cookie);
    expect(reauth.status).toBe(200);
    const verified = await post(
      "/api/auth/reauth/verify",
      { response: await authenticator.login(reauth.body, { origin, rpId }) },
      loggedIn.cookie,
    );
    expect(verified.status).toBe(200);
  },
);

test("rejects the production origin in the local config", async () => {
  const response = await running.harness.fetch("/api/auth/login/options", {
    method: "POST",
    headers: { Origin: "https://manhole-techo.com" },
  });
  expect(response.status).toBe(403);
});

// workerd gives a POST or DELETE without a body an empty stream, not null.
test.each([
  ["POST", "/api/auth/logout", 200],
  ["POST", "/api/auth/login/options", 200],
  ["DELETE", "/api/passkeys/x", 401],
])("accepts %s %s without a body", async (method, path, status) => {
  const response = await running.harness.fetch(path, {
    method,
    headers: { Origin: origin },
  });
  expect(response.status).toBe(status);
});
test("still rejects a body without a content type", async () => {
  const response = await running.harness.fetch("/api/auth/logout", {
    method: "POST",
    headers: { Origin: origin },
    // Bytes get no default Content-Type, unlike a string body.
    body: new TextEncoder().encode("{}"),
  });
  expect(response.status).toBe(415);
});
