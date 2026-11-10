import { ApiError } from "../../features/account/account-api";

// AZ-8 as the Worker enforces it; shown only after it rejects a name.
export const DISPLAY_NAME_RULE =
  "表示名は1〜20文字にしてください。改行や制御文字、文字の向きを変える記号は使えません。";
export const PASSKEY_LABEL_RULE =
  "名前は1〜30文字にしてください。改行や制御文字、文字の向きを変える記号は使えません。";

const byCode: Record<string, string> = {
  unauthorized: "ログインの期限が切れました。もう一度ログインしてください。",
  invalid_credential:
    "パスキーを確かめられませんでした。別のパスキーで試すか、もう一度やり直してください。",
  invalid_challenge: "時間がたちすぎました。もう一度やり直してください。",
  invalid_code: "回復コードが正しくないか、すでに使われています。",
  registration_paused:
    "新しい登録が集中しているため、受け付けを止めています。10分ほど待ってからやり直してください。",
  recovery_paused:
    "回復の受け付けを一時的に止めています。10分ほど待ってからやり直してください。",
  too_many_requests: "操作が多すぎます。しばらく待ってからやり直してください。",
  passkey_limit:
    "パスキーは10本まで登録できます。使っていないものを削除してから追加してください。",
  last_passkey: "最後の1本のパスキーは削除できません。",
  not_found: "いまはアカウント機能を使えません。",
  api_disabled: "いまはアカウント機能を止めています。閲覧はそのまま使えます。",
  auth_unavailable:
    "いまはアカウント機能を止めています。閲覧はそのまま使えます。",
};

export function message(error: unknown) {
  if (error instanceof DOMException && error.name === "InvalidStateError")
    return "この端末のパスキーはすでに登録されています。";
  if (error instanceof DOMException && error.name === "SecurityError")
    return "このアドレスではパスキーを使えません。";
  if (error instanceof ApiError)
    return (
      byCode[error.message] ??
      "うまくいきませんでした。時間をおいてやり直してください。"
    );
  return "通信できませんでした。接続を確かめてやり直してください。";
}
