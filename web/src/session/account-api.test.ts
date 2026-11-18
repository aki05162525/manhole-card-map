import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { api, ApiError, isApiError } from "./account-api";

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
  expect(await api("/api/me")).toEqual({ ok: true });
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
it.each([400, 401, 403, 404, 409, 429, 500])(
  "throws the Worker's error code for %i",
  async (status) => {
    vi.mocked(fetch).mockResolvedValue(
      new Response('{"error":"some_code"}', { status }),
    );
    const error = await api("/api/me").catch((cause: unknown) => cause);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status, message: "some_code" });
    expect(isApiError(error, status)).toBe(true);
    expect(isApiError(error, status, "some_code")).toBe(true);
    expect(isApiError(error, status, "other")).toBe(false);
    expect(isApiError(error, status + 1)).toBe(false);
  },
);
it("names the error unknown when the failure has no JSON code", async () => {
  vi.mocked(fetch).mockResolvedValue(new Response("<html>", { status: 404 }));
  const error = await api("/api/me").catch((cause: unknown) => cause);
  expect(error).toMatchObject({ status: 404, message: "unknown" });
  vi.mocked(fetch).mockResolvedValue(new Response("{}", { status: 500 }));
  expect(await api("/api/me").catch((cause: unknown) => cause)).toMatchObject({
    status: 500,
    message: "unknown",
  });
});
it("returns null for a success without a JSON body", async () => {
  vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 204 }));
  expect(await api("/api/auth/logout", { method: "POST" })).toBeNull();
});
it("passes a network failure through unchanged", async () => {
  const failure = new TypeError("Failed to fetch");
  vi.mocked(fetch).mockRejectedValue(failure);
  const error = await api("/api/me").catch((cause: unknown) => cause);
  expect(error).toBe(failure);
  expect(isApiError(error, 401)).toBe(false);
});
