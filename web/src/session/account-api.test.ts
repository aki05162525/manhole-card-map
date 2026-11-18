import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { isAccountPage, isFriendsPage } from "../contract/private-api";
import { api, ApiError, isApiError } from "./account-api";
import { InvalidAnswer } from "./api";

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response('{"ok":true}')),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
});

it("reads with a same-origin GET and leaves the cache mode to the browser", async () => {
  await api("/api/me");
  expect(vi.mocked(fetch).mock.lastCall).toEqual([
    "/api/me",
    { method: "GET", credentials: "same-origin" },
  ]);
});
it("posts a JSON body, and keeps an explicit method", async () => {
  await api("/api/friends", { body: { userId: "u" } });
  expect(vi.mocked(fetch).mock.lastCall).toEqual([
    "/api/friends",
    {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: '{"userId":"u"}',
    },
  ]);
  await api("/api/me", { method: "PATCH", body: { displayName: "名前" } });
  expect(vi.mocked(fetch).mock.lastCall?.[1]).toMatchObject({
    method: "PATCH",
  });
  await api("/api/friends/u", { method: "DELETE" });
  expect(vi.mocked(fetch).mock.lastCall).toEqual([
    "/api/friends/u",
    { method: "DELETE", credentials: "same-origin" },
  ]);
});
it.each([
  [400, "invalid_display_name"],
  [401, "unauthorized"],
  [403, "recovery_session"],
  [404, "not_found"],
  [409, "friend_limit"],
  [500, "internal"],
] as const)("throws the Worker's error code for %i", async (status, code) => {
  vi.mocked(fetch).mockResolvedValue(
    Response.json({ error: code }, { status }),
  );
  const error = await api("/api/me").catch((cause: unknown) => cause);
  expect(error).toBeInstanceOf(ApiError);
  expect(error).toMatchObject({ status, code, retryAfter: null });
  expect(isApiError(error, status)).toBe(true);
  expect(isApiError(error, status, code)).toBe(true);
  expect(isApiError(error, status, "reauth_required")).toBe(false);
  expect(isApiError(error, status + 1)).toBe(false);
});
it("keeps the seconds a 429 asks to wait", async () => {
  vi.mocked(fetch).mockResolvedValue(
    Response.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Retry-After": "60" } },
    ),
  );
  expect(await api("/api/me").catch((cause: unknown) => cause)).toMatchObject({
    status: 429,
    code: "rate_limited",
    retryAfter: 60,
  });
});
// The header is whatever answered: only whole seconds are a wait to state.
it.each([
  ["0", 0],
  ["-1", null],
  ["1.5", null],
  ["soon", null],
  ["Wed, 21 Oct 2026 07:28:00 GMT", null],
])("reads the Retry-After %j as %j", async (header, retryAfter) => {
  vi.mocked(fetch).mockResolvedValue(
    Response.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Retry-After": header } },
    ),
  );
  expect(await api("/api/me").catch((cause: unknown) => cause)).toMatchObject({
    retryAfter,
  });
});
it("names the error unknown when the failure has no code the Worker returns", async () => {
  for (const body of ["<html>", "{}", '{"error":"some_code"}', '{"error":1}']) {
    vi.mocked(fetch).mockResolvedValue(new Response(body, { status: 404 }));
    const error = await api("/api/me").catch((cause: unknown) => cause);
    expect(error).toMatchObject({ status: 404, code: "unknown" });
  }
});
it("takes a success without a body as done when the operation reads none", async () => {
  vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 204 }));
  expect(await api("/api/auth/logout", { method: "POST" })).toBeUndefined();
});
it("rejects an answer whose body is not what the operation reads", async () => {
  const friends = {
    friends: [{ userId: "u", displayName: "名前", count: 1, since: 0 }],
    requests: [],
    blocks: [],
    invite: { url: "https://manhole-techo.com/friends/invite#t=x" },
  };
  vi.mocked(fetch).mockResolvedValue(Response.json(friends));
  expect(await api("/api/friends", { read: isFriendsPage })).toEqual(friends);
  for (const body of [
    "",
    "null",
    '{"ok":true}',
    JSON.stringify({ ...friends, invite: null }),
    JSON.stringify({ ...friends, friends: [{ userId: "u" }] }),
    JSON.stringify({ profile: { displayName: "名前" }, passkeys: [] }),
  ]) {
    vi.mocked(fetch).mockResolvedValue(new Response(body));
    await expect(api("/api/friends", { read: isFriendsPage })).rejects.toThrow(
      InvalidAnswer,
    );
    await expect(api("/api/account", { read: isAccountPage })).rejects.toThrow(
      InvalidAnswer,
    );
  }
});
it("passes a network failure through unchanged", async () => {
  const failure = new TypeError("Failed to fetch");
  vi.mocked(fetch).mockRejectedValue(failure);
  const error = await api("/api/me").catch((cause: unknown) => cause);
  expect(error).toBe(failure);
  expect(isApiError(error, 401)).toBe(false);
});
