export class ApiError extends Error {
  readonly status: number;
  constructor(status: number, code: string) {
    super(code);
    this.status = status;
  }
}

// Same-origin JSON calls. Errors carry the Worker's `{ error }` code.
export async function api<T = unknown>(
  path: string,
  { method, body }: { method?: string; body?: unknown } = {},
): Promise<T> {
  const response = await fetch(path, {
    method: method ?? (body === undefined ? "GET" : "POST"),
    credentials: "same-origin",
    ...(body !== undefined && {
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  });
  const data = (await response.json().catch(() => null)) as {
    error?: string;
  } | null;
  if (!response.ok)
    throw new ApiError(response.status, data?.error ?? "unknown");
  return data as T;
}

export const isApiError = (error: unknown, status: number, code?: string) =>
  error instanceof ApiError &&
  error.status === status &&
  (code === undefined || error.message === code);
