import {
  errorStatus,
  type ErrorBody,
  type ErrorCode,
} from "../src/contract/api-errors";

/** A failure answered as `{ error: code }`, with the code's status. */
export class HttpError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  readonly headers: HeadersInit | undefined;
  constructor(code: ErrorCode, headers?: HeadersInit) {
    super(code);
    this.status = errorStatus[code];
    this.code = code;
    this.headers = headers;
  }
}

export const json = (body: unknown, status = 200, headers?: HeadersInit) =>
  Response.json(body, {
    status,
    ...(headers === undefined ? {} : { headers }),
  });

/** The answer of a failure. */
export const failure = (error: HttpError) =>
  json({ error: error.code } satisfies ErrorBody, error.status, error.headers);

/** The answer of a failure the Worker did not expect (a bug, D1 down). */
export const internalFailure = () =>
  json({ error: "internal" } satisfies ErrorBody, errorStatus.internal);

// Every API response, errors included, is private (PF-5, SE-1).
export function withApiHeaders(response: Response) {
  const headers = new Headers(response.headers);
  headers.set("Cache-Control", "private, no-store");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "same-origin");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
