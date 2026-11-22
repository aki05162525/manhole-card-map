import { expect, it } from "vitest";
import { errorStatus, type ErrorCode } from "../contract/api-errors";
import { ApiError, apiFailure } from "./api";
import { failureMessage } from "./failure-messages";

const FALLBACK = "保存できませんでした。通信を確認してやり直してください。";

// The platform answers 429 without the Worker's JSON when the requests of a
// day run out (docs/account-design.md, 規模と費用): the user is to wait, not
// to check the network.
it.each([
  [
    "<html>Too Many Requests</html>",
    "120",
    "操作が多いため受け付けられませんでした。2分ほど待ってからやり直してください。",
  ],
  [
    null,
    null,
    "操作が多いため受け付けられませんでした。しばらく待ってからやり直してください。",
  ],
  [
    JSON.stringify({ error: "recovery_paused" }),
    "600",
    "復旧手続きの受け付けを一時停止しています。10分ほど待ってからやり直してください。",
  ],
])(
  "explains a 429 with body %j and Retry-After %s",
  async (body, retryAfter, message) => {
    const response = new Response(body, {
      status: 429,
      headers: retryAfter === null ? {} : { "Retry-After": retryAfter },
    });
    expect(failureMessage(await apiFailure(response), FALLBACK)).toBe(message);
  },
);

// The codes left to the operation's own wording; every other code the
// Worker answers with has a sentence of its own.
const leftToTheOperation = new Set<ErrorCode>([
  "invalid_body",
  "invalid_json",
  "invalid_record",
  "self_block",
  "not_found",
  "method_not_allowed",
  "record_alias_collision",
  "payload_too_large",
  "unsupported_media_type",
  "internal",
]);
it.each(Object.entries(errorStatus) as [ErrorCode, number][])(
  "says something of its own for %s unless it is left to the operation",
  (code, status) => {
    const message = failureMessage(new ApiError(status, code), FALLBACK);
    if (leftToTheOperation.has(code)) expect(message).toBe(FALLBACK);
    else {
      expect(message).not.toBe(FALLBACK);
      expect(message.trim()).not.toBe("");
    }
  },
);

// Rounded up to the minute: the friend requests' daily limit answers the
// seconds left until the next day (`worker/rate-limit.ts`).
it.each([
  [0, "1分ほど"],
  [60, "1分ほど"],
  [61, "2分ほど"],
  [3540, "59分ほど"],
  [3541, "1時間ほど"],
  [3600, "1時間ほど"],
  [3601, "1時間1分ほど"],
  [5400, "1時間30分ほど"],
  [86_400, "24時間ほど"],
])("says %i seconds as %s", (seconds, wait) => {
  expect(
    failureMessage(new ApiError(429, "rate_limited", seconds), FALLBACK),
  ).toBe(
    `操作が多いため受け付けられませんでした。${wait}待ってからやり直してください。`,
  );
});
