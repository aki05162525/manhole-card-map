// Every error code the Worker answers with (`{ error }`), and its status.
// The Worker's HttpError takes the status from here, and the screen has
// wording for each code (`session/failure-messages.ts`, a Record of them):
// a code added here is not done until the screen says something for it.
// `api-errors.test.ts` keeps the list to the codes the Worker returns.
export const errorStatus = {
  invalid_body: 400,
  invalid_challenge: 400,
  invalid_code: 400,
  invalid_credential: 400,
  invalid_display_name: 400,
  invalid_json: 400,
  invalid_label: 400,
  invalid_memo: 400,
  invalid_received_on: 400,
  invalid_record: 400,
  self_block: 400,
  self_request: 400,
  unauthorized: 401,
  forbidden_origin: 403,
  reauth_required: 403,
  recovery_session: 403,
  invite_not_found: 404,
  not_found: 404,
  unknown_credential: 404,
  method_not_allowed: 405,
  friend_limit: 409,
  last_passkey: 409,
  passkey_limit: 409,
  record_alias_collision: 409,
  payload_too_large: 413,
  unsupported_media_type: 415,
  rate_limited: 429,
  recovery_paused: 429,
  registration_paused: 429,
  too_many_requests: 429,
  internal: 500,
  api_disabled: 503,
  auth_unavailable: 503,
  database_unavailable: 503,
} as const satisfies Record<string, number>;

export type ErrorCode = keyof typeof errorStatus;

/** The body of every failure the Worker answers. */
export type ErrorBody = { error: ErrorCode };

export const isErrorCode = (value: unknown): value is ErrorCode =>
  typeof value === "string" && Object.hasOwn(errorStatus, value);
