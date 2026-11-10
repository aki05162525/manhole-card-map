export class ApiError extends Error {
  readonly status: number;
  constructor(status: number, code = "unknown") {
    super(code);
    this.status = status;
  }
}

export const isApiError = (error: unknown, status: number, code?: string) =>
  error instanceof ApiError &&
  error.status === status &&
  (code === undefined || error.message === code);

// Same-origin call to the Worker. The caller chooses the cache mode and
// which statuses are failures: records read 404 as "no record".
export const apiFetch = (path: string, init?: RequestInit) =>
  fetch(path, { ...init, credentials: "same-origin" });

/** The failure a response stands for, with the Worker's `{ error }` code. */
export async function apiFailure(response: Response) {
  const data = (await response.json().catch(() => null)) as {
    error?: string;
  } | null;
  return new ApiError(response.status, data?.error ?? "unknown");
}

/**
 * Wording for the refusals every signed-in action can meet (403, 429), or
 * null for the rest. `outcome` says what did not happen.
 */
export function refusalMessage(error: unknown, outcome: string) {
  return isApiError(error, 403)
    ? "パスキーでログインし直してから操作してください。"
    : isApiError(error, 429)
      ? `操作が多いため${outcome}。しばらく待ってからやり直してください。`
      : null;
}
