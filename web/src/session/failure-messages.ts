import type { ErrorCode } from "../contract/api-errors";
import { memoMax } from "../contract/records";
import { ApiError } from "./api";

// AZ-8 as the Worker enforces it; shown only after it rejects a name.
export const DISPLAY_NAME_RULE =
  "表示名は1〜20文字にしてください。改行や制御文字、文字の向きを変える記号は使えません。";
export const PASSKEY_LABEL_RULE =
  "名前は1〜30文字にしてください。改行や制御文字、文字の向きを変える記号は使えません。";

const PAUSED =
  "現在、アカウント機能を一時停止しています。地図や一覧はそのままご覧いただけます。";

/**
 * How long a 429 asks to wait (`Retry-After`), as the sentence says it: up to
 * the next minute, so it never says less than is left (the friend requests'
 * daily limit answers the seconds until the next day).
 */
function wait(seconds: number | null) {
  if (seconds === null) return "しばらく";
  const minutes = Math.max(1, Math.ceil(seconds / 60));
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${minutes}分ほど`;
  return rest === 0 ? `${hours}時間ほど` : `${hours}時間${rest}分ほど`;
}

const tooMany = (error: ApiError) =>
  `操作が多いため受け付けられませんでした。${wait(error.retryAfter)}待ってからやり直してください。`;

/**
 * What the screen says for each code the Worker answers with. A code the
 * contract adds does not compile until it has an entry here. null leaves it
 * to the operation's own wording (`fallback`): a 404 `not_found` is "no
 * record" to the records and "no accounts here" to the account's page, and
 * the rest are requests the screen never sends unless it has a bug.
 */
const messages: Record<
  ErrorCode,
  string | ((error: ApiError) => string) | null
> = {
  invalid_body: null,
  invalid_challenge: "有効期限が切れました。もう一度やり直してください。",
  invalid_code: "回復コードが正しくないか、すでに使われています。",
  invalid_credential:
    "パスキーを確認できませんでした。別のパスキーで試すか、もう一度やり直してください。",
  invalid_display_name: DISPLAY_NAME_RULE,
  invalid_json: null,
  invalid_label: PASSKEY_LABEL_RULE,
  invalid_memo: `メモは${memoMax}文字までにしてください。`,
  invalid_received_on: "入手した日は今日以前の日付にしてください。",
  invalid_record: null,
  self_block: null,
  self_request: "自分の招待リンクには申請できません。",
  unauthorized: "ログインの期限が切れました。もう一度ログインしてください。",
  forbidden_origin:
    "このページからは操作できません。ページを開き直してやり直してください。",
  reauth_required: "パスキーでログインし直してから操作してください。",
  recovery_session:
    "回復コードでの復旧手続き中は、新しいパスキーを登録するまで他の操作はできません。",
  invite_not_found:
    "この招待リンクは使えません。新しいリンクを送ってもらってください。",
  not_found: null,
  unknown_credential:
    "このパスキーは登録されていません。すでに削除されている可能性があります。別のパスキーでお試しください。",
  method_not_allowed: null,
  friend_limit: "フレンドの上限に達しているため承認できません。",
  last_passkey: "最後の1本のパスキーは削除できません。",
  passkey_limit:
    "パスキーは10本まで登録できます。使っていないものを削除してから追加してください。",
  record_alias_collision: null,
  payload_too_large: null,
  unsupported_media_type: null,
  rate_limited: tooMany,
  recovery_paused: (error) =>
    `復旧手続きの受け付けを一時停止しています。${wait(error.retryAfter)}待ってからやり直してください。`,
  registration_paused: (error) =>
    `新規登録が集中しているため、受け付けを一時停止しています。${wait(error.retryAfter)}待ってからやり直してください。`,
  too_many_requests: (error) =>
    `操作が多すぎます。${wait(error.retryAfter)}待ってからやり直してください。`,
  internal: null,
  api_disabled: PAUSED,
  auth_unavailable: PAUSED,
  database_unavailable:
    "現在、アカウント機能を利用できません。時間をおいてやり直してください。",
};

/**
 * What to say for a failure: the wording of the Worker's code, or
 * `fallback` (a code left to the operation, a failure without a code, a
 * network failure, an answer that was not what the operation reads). A 429
 * without the Worker's code (the platform's, once the day's requests run
 * out) still asks to wait.
 */
export function failureMessage(error: unknown, fallback: string) {
  if (!(error instanceof ApiError)) return fallback;
  if (error.code === "unknown")
    return error.status === 429 ? tooMany(error) : fallback;
  const message = messages[error.code];
  return typeof message === "function" ? message(error) : (message ?? fallback);
}
