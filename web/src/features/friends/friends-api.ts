import { isApiError } from "../../session/api";
import { UserChanged, userChangedMessage } from "../../session/session-guard";
import { failureMessage } from "../../session/failure-messages";
import { japanFormat } from "../../contract/japan-time";

export function friendError(error: unknown) {
  if (error instanceof UserChanged) return userChangedMessage(error);
  return isApiError(error, 401)
    ? "ログインし直してください。"
    : failureMessage(error, "通信を確認してやり直してください。");
}

const date = /* @__PURE__ */ japanFormat({
  year: "numeric",
  month: "numeric",
  day: "numeric",
});
export const friendDate = (time: number) => date.format(time);
