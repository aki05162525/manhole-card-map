import { isApiError, UserChanged } from "../../session/account-api";
import { refusalMessage } from "../../session/api";
import { userChangedMessage } from "../../session/session-guard";
import { japanFormat } from "../../contract/japan-time";

export type Person = { userId: string; displayName: string };
export type Friend = Person & { count: number; since: number };
export type Request = Person & { requestedAt: number };
export type Block = Person & { blockedAt: number };
export type Invite = { url: string };

export function friendError(error: unknown) {
  if (error instanceof UserChanged) return userChangedMessage(error);
  return isApiError(error, 401)
    ? "ログインし直してください。"
    : (refusalMessage(error, "受け付けられませんでした") ??
        (isApiError(error, 409)
          ? "フレンドの上限に達しているため承認できません。"
          : "通信を確認してやり直してください。"));
}

const date = /* @__PURE__ */ japanFormat({
  year: "numeric",
  month: "numeric",
  day: "numeric",
});
export const friendDate = (time: number) => date.format(time);
