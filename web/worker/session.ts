import type { Context } from "./app";
import type { D1PreparedStatement } from "./env";
import { randomToken, sha256Hex } from "./encoding";
import { HttpError } from "./http";
import { DAY, MINUTE } from "./time";

// AU-5 and AU-9.
const IDLE = 30 * DAY;
const LIFETIME = 180 * DAY;
const RECOVERY = 15 * MINUTE;
const REFRESH = DAY;
// AU-11.
const RECENT = 5 * MINUTE;

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
  tokenHash: string;
};

type Row = {
  user_id: string;
  kind: Session["kind"];
  created_at: number;
  expires_at: number;
  verified_at: number | null;
};

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

const deleteSession = (context: Context, tokenHash: string) =>
  context.env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?")
    .bind(tokenHash)
    .run();

// Deletes the row of the session the request presented, if any.
async function deletePresented(context: Context) {
  const token = presentedToken(context.request);
  if (token && tokenPattern.test(token))
    await deleteSession(context, await sha256Hex(token));
}

async function getSession(context: Context) {
  if (context.session !== undefined) return context.session;
  context.session = null;
  const token = presentedToken(context.request);
  if (token === undefined) return null;
  if (!tokenPattern.test(token)) {
    clearCookies(context);
    return null;
  }
  const tokenHash = await sha256Hex(token);
  const { DB } = context.env;
  const row = await DB.prepare(
    "SELECT user_id, kind, created_at, expires_at, verified_at FROM sessions WHERE token_hash = ?",
  )
    .bind(tokenHash)
    .first<Row>();
  if (!row || context.now >= row.expires_at) {
    if (row) await deleteSession(context, tokenHash);
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
    tokenHash,
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

// Deleting a passkey, reissuing recovery codes and deleting the account need
// a passkey verification within five minutes (AU-11).
export async function requireRecentAuth(context: Context) {
  const session = await requireSession(context);
  if (session.verifiedAt === null || context.now - session.verifiedAt > RECENT)
    throw new HttpError(403, "reauth_required");
  return session;
}

export async function markVerified(context: Context, session: Session) {
  await context.env.DB.prepare(
    "UPDATE sessions SET verified_at = ? WHERE token_hash = ?",
  )
    .bind(context.now, session.tokenHash)
    .run();
  session.verifiedAt = context.now;
}

// Logout: the row goes first so the token stops working even if the cookie
// is kept.
export async function endSession(context: Context) {
  await deletePresented(context);
  context.session = null;
  clearCookies(context);
}

// Called after a passkey login or a recovery code; replaces the presented
// session so a planted cookie never survives the login (AU-5).
export async function createSession(
  context: Context,
  userId: string,
  kind: Session["kind"],
) {
  await deletePresented(context);
  const token = randomToken(32);
  const tokenHash = await sha256Hex(token);
  const session: Session = {
    userId,
    kind,
    createdAt: context.now,
    expiresAt: context.now + (kind === "normal" ? IDLE : RECOVERY),
    verifiedAt: kind === "normal" ? context.now : null,
    tokenHash,
  };
  await context.env.DB.prepare(
    "INSERT INTO sessions (token_hash, user_id, kind, created_at, expires_at, verified_at) VALUES (?, ?, ?, ?, ?, ?)",
  )
    .bind(
      tokenHash,
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

// Turns a recovery session into a normal, freshly verified one and ends
// every other session of the user, in one batch with `statements` (the new
// passkey). The new row takes its user from the recovery row, so once that
// row is gone or expired the INSERT fails and the whole batch rolls back:
// two racing registrations promote once (AU-9, AU-11).
export async function promoteRecovery(
  context: Context,
  session: Session,
  statements: D1PreparedStatement[],
) {
  const { DB } = context.env;
  const token = randomToken(32);
  const tokenHash = await sha256Hex(token);
  const expiresAt = context.now + IDLE;
  try {
    await DB.batch([
      DB.prepare(
        `INSERT INTO sessions (token_hash, user_id, kind, created_at, expires_at, verified_at)
        SELECT ?1, (SELECT user_id FROM sessions WHERE token_hash = ?2 AND kind = 'recovery' AND expires_at > ?3), 'normal', ?3, ?4, ?3`,
      ).bind(tokenHash, session.tokenHash, context.now, expiresAt),
      ...statements,
      DB.prepare(
        "DELETE FROM sessions WHERE user_id = ? AND token_hash <> ?",
      ).bind(session.userId, tokenHash),
    ]);
  } catch (error) {
    const current = await DB.prepare(
      "SELECT 1 FROM sessions WHERE token_hash = ? AND kind = 'recovery' AND expires_at > ?",
    )
      .bind(session.tokenHash, context.now)
      .first();
    if (current) throw error;
    context.session = null;
    clearCookies(context);
    throw new HttpError(401, "unauthorized");
  }
  context.session = {
    userId: session.userId,
    kind: "normal",
    createdAt: context.now,
    expiresAt,
    verifiedAt: context.now,
    tokenHash,
  };
  setCookies(context, token, expiresAt, true);
}
