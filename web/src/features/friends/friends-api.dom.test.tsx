import { expect, it } from "vitest";
import { ApiError } from "../../session/account-api";
import { friendError } from "./friends-api";

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
