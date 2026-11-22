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
    return "このアドレスではパスキーを使えません。";
  // Without D1 (a preview), every route answers 404 `not_found`.
  if (isApiError(error, 404, "not_found"))
    return "いまはアカウント機能を使えません。";
  if (error instanceof ApiError)
    return failureMessage(
      error,
      "うまくいきませんでした。時間をおいてやり直してください。",
    );
  return "通信できませんでした。接続を確かめてやり直してください。";
}
