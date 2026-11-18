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
// Not secret either: changes with each session, so a page that kept one
// user's records sees that another has signed in since. Display only; the
// HttpOnly session authorizes.
const MARK = "session_mark";
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

// A hash of the stored hash, cut short. It does not lead back to the token
// or to the stored hash, though anyone who has the stored hash can compute
// it and so tell which row it belongs to.
const sessionMark = async (tokenHash: string) =>
  (await sha256Hex(`session_mark:${tokenHash}`)).slice(0, 16);

// The cookies are set only in answer to the user's own login, recovery,
// passkey registration after recovery, logout or deletion. Any other
// request may have been sent before another user signed in on the same
// browser and be answered after: its Set-Cookie would sign that user out or
// put the earlier one back. So a 401 leaves the cookies (the pages forget
// their display cookies when the 401 is for the user they show, and the
// HttpOnly one stays only to be refused), and a normal session's cookies
// last from the start to its absolute expiry while its idle expiry slides
// in the row alone (AU-5, AU-6).
function setCookies(
  context: Context,
  token: string,
  expiresAt: number,
  mark: string | null,
) {
  const age = Math.max(0, Math.floor((expiresAt - context.now) / 1000));
  context.cookies.push(
    `${COOKIE}=${token}; Max-Age=${age}; Path=/; Secure; HttpOnly; SameSite=Lax`,
    // A recovery session cannot read records, so the pages stay signed out.
    ...(mark
      ? [
          `${SIGNED_IN}=1; Max-Age=${age}; Path=/; Secure; SameSite=Lax`,
          `${MARK}=${mark}; Max-Age=${age}; Path=/; Secure; SameSite=Lax`,
        ]
      : [
          `${SIGNED_IN}=; Max-Age=0; Path=/; Secure; SameSite=Lax`,
          `${MARK}=; Max-Age=0; Path=/; Secure; SameSite=Lax`,
        ]),
  );
}

const clearCookies = (context: Context) =>
  setCookies(context, "", context.now, null);

const deleteSession = (context: Context, tokenHash: string) =>
  context.env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?")
    .bind(tokenHash)
    .run();

// Deletes the row of the session the request presented, if any.
async function deletePresented(context: Context) {
  const tokenHash = await presentedHash(context);
  if (tokenHash) await deleteSession(context, tokenHash);
}

const selectRow = (context: Context, tokenHash: string) =>
  context.env.DB.prepare(
    "SELECT user_id, kind, created_at, expires_at, verified_at FROM sessions WHERE token_hash = ?",
  ).bind(tokenHash);

// The hash of the cookie's token, unless malformed.
async function presentedHash(context: Context) {
  const token = presentedToken(context.request);
  if (token === undefined || !tokenPattern.test(token)) return undefined;
  return sha256Hex(token);
}

// Turns the stored row of the presented token into the session, or deletes
// it once expired.
async function accept(context: Context, tokenHash: string, row: Row | null) {
  if (!row || context.now >= row.expires_at) {
    if (row) await deleteSession(context, tokenHash);
    return null;
  }
  let expiresAt = row.expires_at;
  const slid = Math.min(context.now + IDLE, row.created_at + LIFETIME);
  // Recovery sessions never slide; normal ones write at most once a day.
  if (row.kind === "normal" && slid - expiresAt >= REFRESH) {
    expiresAt = slid;
    await context.env.DB.prepare(
      "UPDATE sessions SET expires_at = ? WHERE token_hash = ?",
    )
      .bind(expiresAt, tokenHash)
      .run();
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

async function getSession(context: Context) {
  if (context.session !== undefined) return context.session;
  context.session = null;
  const tokenHash = await presentedHash(context);
  if (!tokenHash) return null;
  return accept(
    context,
    tokenHash,
    await selectRow(context, tokenHash).first<Row>(),
  );
}

// 401 without a session; 403 for a recovery session unless the route only
// registers a passkey (AU-9).
function authorize(session: Session | null, allowRecovery: boolean) {
  if (!session) throw new HttpError("unauthorized");
  if (session.kind === "recovery" && !allowRecovery)
    throw new HttpError("recovery_session");
  return session;
}

export async function requireSession(
  context: Context,
  { allowRecovery = false } = {},
) {
  return authorize(await getSession(context), allowRecovery);
}

// The user of a query passed to readAsUser: that of the presented token,
// while its session is normal and unexpired.
export const ME =
  "(SELECT user_id FROM sessions WHERE token_hash = ?1 AND kind = 'normal' AND expires_at > ?2)";

// An SQL statement and the values of its own parameters, numbered from ?3;
// ?2 is the request time.
type Query = [sql: string, ...values: unknown[]];

// requireSession and the queries in one batch, so a page's first read costs
// one round trip to D1 instead of two in a row. The queries read the user as
// ME, never as an ID taken from the session row; their rows are returned only
// after that row passes the checks of requireSession.
export async function readAsUser<T extends unknown[]>(
  context: Context,
  ...queries: { [K in keyof T]: Query }
): Promise<{ session: Session; rows: { [K in keyof T]: T[K][] } }> {
  context.session = null;
  const tokenHash = await presentedHash(context);
  if (!tokenHash) throw new HttpError("unauthorized");
  const { DB } = context.env;
  const [row, ...results] = (await DB.batch([
    selectRow(context, tokenHash),
    ...queries.map(([sql, ...values]) =>
      DB.prepare(sql).bind(tokenHash, context.now, ...values),
    ),
  ])) as { results: unknown[] }[];
  const session = authorize(
    await accept(
      context,
      tokenHash,
      (row.results[0] as Row | undefined) ?? null,
    ),
    false,
  );
  return {
    session,
    rows: results.map(({ results }) => results) as { [K in keyof T]: T[K][] },
  };
}

// Adding or deleting a passkey, reissuing recovery codes and deleting the account need
// a passkey verification within five minutes (AU-11).
export async function requireRecentAuth(context: Context) {
  const session = await requireSession(context);
  if (session.verifiedAt === null || context.now - session.verifiedAt > RECENT)
    throw new HttpError("reauth_required");
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
  const normal = kind === "normal";
  const session: Session = {
    userId,
    kind,
    createdAt: context.now,
    expiresAt: context.now + (normal ? IDLE : RECOVERY),
    verifiedAt: normal ? context.now : null,
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
  setCookies(
    context,
    token,
    normal ? context.now + LIFETIME : session.expiresAt,
    normal ? await sessionMark(tokenHash) : null,
  );
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
    // The other registration may have set the cookies of its new session.
    context.session = null;
    throw new HttpError("unauthorized");
  }
  context.session = {
    userId: session.userId,
    kind: "normal",
    createdAt: context.now,
    expiresAt,
    verifiedAt: context.now,
    tokenHash,
  };
  setCookies(
    context,
    token,
    context.now + LIFETIME,
    await sessionMark(tokenHash),
  );
}
