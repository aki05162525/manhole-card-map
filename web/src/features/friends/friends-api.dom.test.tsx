import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ApiError } from "../account/account-api";
import { friendError, friendsApi } from "./friends-api";

beforeEach(() => {
  document.cookie = "signed_in=1; Path=/";
});
afterEach(() => {
  document.cookie = "signed_in=; Max-Age=0; Path=/";
  vi.unstubAllGlobals();
});

it("forgets the display cookie on 401 and rethrows", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () => new Response('{"error":"unauthorized"}', { status: 401 }),
    ),
  );
  const error = await friendsApi("/api/friends").catch(
    (cause: unknown) => cause,
  );
  expect(error).toMatchObject({ status: 401, message: "unauthorized" });
  expect(document.cookie).not.toContain("signed_in=1");
  expect(vi.mocked(fetch).mock.lastCall).toEqual([
    "/api/friends",
    { method: "GET", credentials: "same-origin" },
  ]);
});
it.each([403, 404, 409, 429, 500])(
  "keeps the display cookie and throws on %i",
  async (status) => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response('{"error":"code"}', { status })),
    );
    const error = await friendsApi("/api/friends").catch(
      (cause: unknown) => cause,
    );
    expect(error).toMatchObject({ status, message: "code" });
    expect(document.cookie).toContain("signed_in=1");
  },
);
it("keeps the display cookie when the network fails", async () => {
  const failure = new TypeError("Failed to fetch");
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(failure));
  expect(
    await friendsApi("/api/friends").catch((cause: unknown) => cause),
  ).toBe(failure);
  expect(document.cookie).toContain("signed_in=1");
});
it.each([
  [401, "ログインし直してください。"],
  [403, "パスキーでログインし直してから操作してください。"],
  [
    429,
    "操作が多いため受け付けられませんでした。しばらく待ってからやり直してください。",
  ],
  [409, "フレンドの上限に達しているため承認できません。"],
  [404, "通信を確認してやり直してください。"],
  [500, "通信を確認してやり直してください。"],
])("words a %i failure", (status, text) => {
  expect(friendError(new ApiError(status, "code"))).toBe(text);
});
it("words a network failure", () => {
  expect(friendError(new TypeError("Failed to fetch"))).toBe(
    "通信を確認してやり直してください。",
  );
});
