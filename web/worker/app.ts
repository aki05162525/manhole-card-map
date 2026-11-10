import type { D1Database, Env } from "./env";
import { HttpError, json, withApiHeaders } from "./http";
import type { Session } from "./session";

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type Context = {
  request: Request;
  env: Env & { DB: D1Database };
  now: number;
  params: Record<string, string>;
  body: unknown;
  // Set-Cookie values added to the response.
  cookies: string[];
  // Fixed event names added to the request log line, never values (PR-2).
  events: string[];
  // Cached by getSession; undefined until read.
  session?: Session | null;
};

export type Route = {
  method: Method;
  // Exact segments; `:name` captures one segment into params.
  path: string;
  // WebAuthn responses carry attestation objects (AU-14).
  body?: "json" | "webauthn";
  handle: (context: Context) => Response | Promise<Response>;
};

const unsafeMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const bodyLimits = { json: 16 * 1024, webauthn: 64 * 1024 };

function match(route: Route, pathname: string) {
  const expected = route.path.split("/");
  const actual = pathname.split("/");
  if (expected.length !== actual.length) return undefined;
  const params: Record<string, string> = {};
  for (const [index, segment] of expected.entries()) {
    const value = actual[index]!;
    if (segment.startsWith(":")) {
      if (!value) return undefined;
      try {
        params[segment.slice(1)] = decodeURIComponent(value);
      } catch {
        return undefined;
      }
    } else if (segment !== value) return undefined;
  }
  return params;
}

async function readLimited(request: Request, limit: number) {
  const declared = Number(request.headers.get("Content-Length"));
  if (declared > limit) throw new HttpError(413, "payload_too_large");
  const reader = request.body!.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      throw new HttpError(413, "payload_too_large");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

// CSRF defence (AU-7): state changes need the exact production Origin and a
// JSON body, which a cross-site form cannot send without a CORS preflight.
async function readBody(request: Request, route: Route, env: Env) {
  if (!unsafeMethods.has(request.method)) return undefined;
  const origin = request.headers.get("Origin");
  if (!env.ALLOWED_ORIGIN || origin !== env.ALLOWED_ORIGIN)
    throw new HttpError(403, "forbidden_origin");
  const type = request.headers.get("Content-Type");
  const isJson =
    type?.split(";")[0]!.trim().toLowerCase() === "application/json";
  if (type !== null && !isJson)
    throw new HttpError(415, "unsupported_media_type");
  if (!request.body) return undefined;
  // workerd hands a request without a body an empty stream, not null.
  const text = await readLimited(request, bodyLimits[route.body ?? "json"]);
  if (!text) return undefined;
  if (!isJson) throw new HttpError(415, "unsupported_media_type");
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new HttpError(400, "invalid_json");
  }
}

type Options = {
  routes: Route[];
  clock?: () => number;
  // Receives one JSON line per request (PR-2).
  log?: (line: string) => void;
};

export function createApp({
  routes,
  clock = Date.now,
  log = console.log,
}: Options) {
  return async (request: Request, env: Env) => {
    const started = clock();
    const pathname = new URL(request.url).pathname;
    let template = "unmatched";
    let context: Context | undefined;
    let errorKind: string | undefined;
    let response: Response;
    try {
      if (!pathname.startsWith("/api/")) throw new HttpError(404, "not_found");
      if (env.API_DISABLED) throw new HttpError(503, "api_disabled");
      if (!env.DB) throw new HttpError(404, "not_found");
      const matched = routes.flatMap((route) => {
        const params = match(route, pathname);
        return params ? [{ route, params }] : [];
      });
      if (!matched.length) throw new HttpError(404, "not_found");
      const found = matched.find(
        ({ route }) => route.method === request.method,
      );
      if (!found)
        throw new HttpError(405, "method_not_allowed", {
          Allow: [...new Set(matched.map(({ route }) => route.method))].join(
            ", ",
          ),
        });
      template = found.route.method + " " + found.route.path;
      context = {
        request,
        env: { ...env, DB: env.DB },
        now: started,
        params: found.params,
        body: await readBody(request, found.route, env),
        cookies: [],
        events: [],
      };
      response = await found.route.handle(context);
    } catch (error) {
      if (error instanceof HttpError) {
        response = json({ error: error.code }, error.status, error.headers);
        errorKind = error.code;
      } else {
        response = json({ error: "internal" }, 500);
        errorKind = error instanceof Error ? error.name : "unknown";
      }
    }
    response = withApiHeaders(response);
    for (const cookie of context?.cookies ?? [])
      response.headers.append("Set-Cookie", cookie);
    // Never the URL, body, cookies or names: only what PR-2 allows.
    log(
      JSON.stringify({
        route: template,
        status: response.status,
        ms: clock() - started,
        ...(errorKind && { error: errorKind }),
        ...(context?.events.length && { events: context.events }),
        ...(context?.session && { user: context.session.userId }),
      }),
    );
    return response;
  };
}
