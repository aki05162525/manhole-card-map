import { expect, it } from "vitest";
import { ApiError } from "../../session/account-api";
import { friendError } from "./friends-api";

const again = "通信を確認してやり直してください。";
it.each([
  [401, "unauthorized", "ログインし直してください。"],
  [403, "reauth_required", "パスキーでログインし直してから操作してください。"],
  [
    403,
    "recovery_session",
    "回復コードで入った後は、パスキーを登録するまでほかの操作はできません。",
  ],
  [
    429,
    "rate_limited",
    "操作が多いため受け付けられませんでした。しばらく待ってからやり直してください。",
  ],
  [409, "friend_limit", "フレンドの上限に達しているため承認できません。"],
  [404, "not_found", again],
  [500, "internal", again],
  [502, "unknown", again],
] as const)("words a %i %s failure", (status, code, text) => {
  expect(friendError(new ApiError(status, code))).toBe(text);
});
it.each([
  [60, "1分ほど"],
  [600, "10分ほど"],
  [86_400, "24時間ほど"],
])("tells the wait a 429 asks for (%i seconds)", (seconds, wait) => {
  expect(friendError(new ApiError(429, "rate_limited", seconds))).toBe(
    `操作が多いため受け付けられませんでした。${wait}待ってからやり直してください。`,
  );
});
it("words a network failure", () => {
  expect(friendError(new TypeError("Failed to fetch"))).toBe(again);
});
