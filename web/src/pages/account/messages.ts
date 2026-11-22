import { ApiError, isApiError } from "../../session/api";
import { UserChanged, userChangedMessage } from "../../session/session-guard";
import { failureMessage } from "../../session/failure-messages";

export {
  DISPLAY_NAME_RULE,
  PASSKEY_LABEL_RULE,
} from "../../session/failure-messages";
export const DISPLAY_NAME_EMPTY = "表示名を入力してください。";
export const PASSKEY_LABEL_EMPTY = "名前を入力してください。";

export function message(error: unknown) {
  if (error instanceof UserChanged) return userChangedMessage(error);
  if (error instanceof DOMException && error.name === "InvalidStateError")
    return "この端末のパスキーはすでに登録されています。";
  if (error instanceof DOMException && error.name === "SecurityError")
    return "このURLではパスキーを使えません。";
  // Without D1 (a preview), every route answers 404 `not_found`.
  if (isApiError(error, 404, "not_found"))
    return "現在、アカウント機能を利用できません。";
  if (error instanceof ApiError)
    return failureMessage(
      error,
      "処理に失敗しました。時間をおいてもう一度お試しください。",
    );
  return "通信できませんでした。ネットワーク接続を確認してもう一度お試しください。";
}
