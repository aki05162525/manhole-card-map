import { isErrorCode, type ErrorCode } from "../contract/api-errors";
import type { Guard } from "../contract/shape";

/** A code the Worker does not answer with (a page of the platform, none). */
type FailureCode = ErrorCode | "unknown";

/**
 * A failure the Worker answered: its status, its `{ error }` code, and for a
 * 429 the seconds it asks to wait (`Retry-After`), or null.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: FailureCode;
  readonly retryAfter: number | null;
  constructor(
    status: number,
    code: FailureCode = "unknown",
    retryAfter: number | null = null,
  ) {
    super(code);
    this.status = status;
    this.code = code;
    this.retryAfter = retryAfter;
  }
}

/** A success whose body is not what the operation reads. */
export class InvalidAnswer extends Error {
  constructor(path: string) {
    super("invalid answer: " + path);
  }
}

export const isApiError = (error: unknown, status: number, code?: ErrorCode) =>
  error instanceof ApiError &&
  error.status === status &&
  (code === undefined || error.code === code);

// Same-origin call to the Worker. The caller chooses the cache mode and
// which statuses are failures: records read 404 as "no record".
export const apiFetch = (path: string, init?: RequestInit) =>
  fetch(path, { ...init, credentials: "same-origin" });

const seconds = (header: string | null) => {
  const value = header === null ? NaN : Number(header);
  return Number.isInteger(value) && value >= 0 ? value : null;
};

/** The failure a response stands for, with the Worker's `{ error }` code. */
export async function apiFailure(response: Response) {
  const data: unknown = await response.json().catch(() => undefined);
  const code =
    typeof data === "object" && data !== null && "error" in data
      ? data.error
      : undefined;
  return new ApiError(
    response.status,
    isErrorCode(code) ? code : "unknown",
    seconds(response.headers.get("Retry-After")),
  );
}

/** The body of a success, once it has the shape `read` checks. */
export async function answerOf<T>(
  response: Response,
  path: string,
  read: Guard<T>,
) {
  const value: unknown = await response.json().catch(() => undefined);
  if (!read(value)) throw new InvalidAnswer(path);
  return value;
}
