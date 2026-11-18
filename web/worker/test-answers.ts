import { expect } from "vitest";
import { errorStatus, isErrorCode } from "../src/contract/api-errors";
import {
  isAccountPage,
  isCreationOptions,
  isFriendReceipts,
  isFriendsPage,
  isInvite,
  isInviteLookup,
  isPasskeyAccount,
  isProfile,
  isReceipts,
  isRecordDetail,
  isRecoveryCodes,
  isRecoveryStart,
  isRequestOptions,
  isSavedRecord,
} from "../src/contract/private-api";
import type { Guard } from "../src/contract/shape";

// The screen's own check for each answer it reads a body from.
const reads: [method: string, path: RegExp, read: Guard<unknown>][] = [
  ["GET", /^\/api\/account$/, isAccountPage],
  ["PATCH", /^\/api\/me$/, isProfile],
  ["DELETE", /^\/api\/me$/, isPasskeyAccount],
  [
    "POST",
    /^\/api\/auth\/register\/verify$/,
    (value) => isProfile(value) && isRecoveryCodes(value),
  ],
  ["POST", /^\/api\/passkeys\/register\/verify$/, isProfile],
  ["POST", /^\/api\/(auth|passkeys)\/register\/options$/, isCreationOptions],
  ["POST", /^\/api\/auth\/(login|reauth)\/options$/, isRequestOptions],
  ["POST", /^\/api\/recovery-codes$/, isRecoveryCodes],
  ["POST", /^\/api\/auth\/recover$/, isRecoveryStart],
  ["GET", /^\/api\/friends$/, isFriendsPage],
  ["GET", /^\/api\/friends\/[^/]+\/records$/, isFriendReceipts],
  ["POST", /^\/api\/invite$/, isInvite],
  ["POST", /^\/api\/invite\/lookup$/, isInviteLookup],
  ["GET", /^\/api\/me\/records$/, isReceipts],
  ["GET", /^\/api\/me\/records\/[^/]+$/, isRecordDetail],
  ["PUT", /^\/api\/me\/records\/[^/]+$/, isSavedRecord],
];

/**
 * `app`, holding every answer to the contract the screen reads it by: a
 * success it reads a body from passes the screen's check, and a failure is
 * `{ error }` with a listed code and that code's status.
 */
export function checkedAnswers<Env>(
  app: (request: Request, env: Env) => Promise<Response>,
) {
  return async (request: Request, env: Env) => {
    const { method } = request;
    const { pathname } = new URL(request.url);
    const response = await app(request, env);
    if (!pathname.startsWith("/api/")) return response;
    const body: unknown = await response
      .clone()
      .json()
      .catch(() => undefined);
    if (response.ok) {
      const found = reads.find(
        ([routeMethod, path]) => routeMethod === method && path.test(pathname),
      );
      if (found) expect(found[2](body), `${method} ${pathname}`).toBe(true);
    } else {
      const code =
        typeof body === "object" && body !== null
          ? Reflect.get(body, "error")
          : undefined;
      expect(isErrorCode(code), `${method} ${pathname}`).toBe(true);
      if (isErrorCode(code)) expect(response.status).toBe(errorStatus[code]);
    }
    return response;
  };
}
