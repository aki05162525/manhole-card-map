import { expect, it } from "vitest";
import { ApiError } from "../../session/api";
import { friendError } from "./friends-api";

const again = "通信を確認してやり直してください。";
it.each([
  [401, "unauthorized", "ログインし直してください。"],
  [403, "reauth_required", "パスキーでログインし直してから操作してください。"],
  [
    403,
    "recovery_session",
    "回復コードでの復旧手続き中は、新しいパスキーを登録するまで他の操作はできません。",
  ],
  [
    429,
    "rate_limited",
    "操作が多いため受け付けられませんでした。10分ほど待ってからやり直してください。",
    600,
  ],
  [409, "friend_limit", "フレンドの上限に達しているため承認できません。"],
  [404, "not_found", again],
  [502, "unknown", again],
] as const)(
  "words a %i %s failure",
  (status, code, text, retryAfter?: number) => {
    expect(friendError(new ApiError(status, code, retryAfter))).toBe(text);
  },
);
it("words a network failure", () => {
  expect(friendError(new TypeError("Failed to fetch"))).toBe(again);
});
