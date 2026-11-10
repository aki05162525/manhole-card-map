export class HttpError extends Error {
  readonly status: number;
  readonly code: string;
  readonly headers: HeadersInit | undefined;
  constructor(status: number, code: string, headers?: HeadersInit) {
    super(code);
    this.status = status;
    this.code = code;
    this.headers = headers;
  }
}

export const json = (body: unknown, status = 200, headers?: HeadersInit) =>
  Response.json(body, { status, headers });

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
