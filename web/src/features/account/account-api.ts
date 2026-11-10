import { apiFailure, apiFetch } from "../../shared/browser/api";

export { ApiError, isApiError } from "../../shared/browser/api";

// Same-origin JSON calls. Errors carry the Worker's `{ error }` code.
export async function api<T = unknown>(
  path: string,
  { method, body }: { method?: string; body?: unknown } = {},
): Promise<T> {
  const response = await apiFetch(path, {
    method: method ?? (body === undefined ? "GET" : "POST"),
    ...(body !== undefined && {
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  });
  if (!response.ok) throw await apiFailure(response);
  return (await response.json().catch(() => null)) as T;
}
