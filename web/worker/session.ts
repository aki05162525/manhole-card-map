import type { Context } from "./app";
import { HttpError } from "./http";

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;
// AU-5 and AU-9.
const IDLE = 30 * DAY;
const LIFETIME = 180 * DAY;
const RECOVERY = 15 * MINUTE;
const REFRESH = DAY;

const COOKIE = "__Host-session";
// Not secret: tells the static pages to fetch records after the map starts.
const SIGNED_IN = "signed_in";
const tokenPattern = /^[A-Za-z0-9_-]{43}$/;

export type Session = {
  userId: string;
  kind: "normal" | "recovery";
  createdAt: number;
  expiresAt: number;
  // Time of the last passkey verification, for AU-11.
  verifiedAt: number | null;
};

type Row = {
  user_id: string;
  kind: Session["kind"];
  created_at: number;
  expires_at: number;
  verified_at: number | null;
};

export const base64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");

export async function hash(token: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function presentedToken(request: Request) {
  for (const part of request.headers.get("Cookie")?.split(";") ?? []) {
    const [name, ...value] = part.trim().split("=");
    if (name === COOKIE) return value.join("=");
  }
  return undefined;
}

function setCookies(
  context: Context,
  token: string,
  expiresAt: number,
  signedIn: boolean,
) {
  const age = Math.max(0, Math.floor((expiresAt - context.now) / 1000));
  context.cookies.push(
    `${COOKIE}=${token}; Max-Age=${age}; Path=/; Secure; HttpOnly; SameSite=Lax`,
    // A recovery session cannot read records, so the pages stay signed out.
    signedIn
      ? `${SIGNED_IN}=1; Max-Age=${age}; Path=/; Secure; SameSite=Lax`
      : `${SIGNED_IN}=; Max-Age=0; Path=/; Secure; SameSite=Lax`,
  );
}

const clearCookies = (context: Context) =>
  setCookies(context, "", context.now, false);

async function getSession(context: Context) {
  if (context.session !== undefined) return context.session;
  context.session = null;
  const token = presentedToken(context.request);
  if (token === undefined) return null;
  if (!tokenPattern.test(token)) {
    clearCookies(context);
    return null;
  }
  const tokenHash = await hash(token);
  const { DB } = context.env;
  const row = await DB.prepare(
    "SELECT user_id, kind, created_at, expires_at, verified_at FROM sessions WHERE token_hash = ?",
  )
    .bind(tokenHash)
    .first<Row>();
  if (!row || context.now >= row.expires_at) {
    if (row)
      await DB.prepare("DELETE FROM sessions WHERE token_hash = ?")
        .bind(tokenHash)
        .run();
    clearCookies(context);
    return null;
  }
  let expiresAt = row.expires_at;
  const slid = Math.min(context.now + IDLE, row.created_at + LIFETIME);
  // Recovery sessions never slide; normal ones write at most once a day.
  if (row.kind === "normal" && slid - expiresAt >= REFRESH) {
    expiresAt = slid;
    await DB.prepare("UPDATE sessions SET expires_at = ? WHERE token_hash = ?")
      .bind(expiresAt, tokenHash)
      .run();
    setCookies(context, token, expiresAt, true);
  }
  context.session = {
    userId: row.user_id,
    kind: row.kind,
    createdAt: row.created_at,
    expiresAt,
    verifiedAt: row.verified_at,
  };
  return context.session;
}

// 401 without a session; 403 for a recovery session unless the route only
// registers a passkey (AU-9).
export async function requireSession(
  context: Context,
  { allowRecovery = false } = {},
) {
  const session = await getSession(context);
  if (!session) throw new HttpError(401, "unauthorized");
  if (session.kind === "recovery" && !allowRecovery)
    throw new HttpError(403, "recovery_session");
  return session;
}

// Called after a passkey login or a recovery code; replaces the presented
// session so a planted cookie never survives the login (AU-5).
export async function createSession(
  context: Context,
  userId: string,
  kind: Session["kind"],
) {
  const { DB } = context.env;
  const previous = presentedToken(context.request);
  if (previous && tokenPattern.test(previous))
    await DB.prepare("DELETE FROM sessions WHERE token_hash = ?")
      .bind(await hash(previous))
      .run();
  const token = base64url(crypto.getRandomValues(new Uint8Array(32)));
  const session: Session = {
    userId,
    kind,
    createdAt: context.now,
    expiresAt: context.now + (kind === "normal" ? IDLE : RECOVERY),
    verifiedAt: kind === "normal" ? context.now : null,
  };
  await DB.prepare(
    "INSERT INTO sessions (token_hash, user_id, kind, created_at, expires_at, verified_at) VALUES (?, ?, ?, ?, ?, ?)",
  )
    .bind(
      await hash(token),
      userId,
      kind,
      session.createdAt,
      session.expiresAt,
      session.verifiedAt,
    )
    .run();
  context.session = session;
  setCookies(context, token, session.expiresAt, kind === "normal");
  return session;
}
