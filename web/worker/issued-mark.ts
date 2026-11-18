import type { Context } from "./app";
import { randomToken } from "./encoding";

const MARK = "session_mark=";

/**
 * The mark of the session this answer's own cookies begin, for its body:
 * the page gives what the answer holds (recovery codes, a recovery's new
 * session) only to that session, as the cookies may name another by the
 * time it is read (PF-5). Read from the cookies set, so the two never
 * differ; undefined when the answer sets none.
 */
export function issuedMark(context: Context) {
  let mark: string | undefined;
  for (const cookie of context.cookies)
    if (cookie.startsWith(MARK))
      mark = cookie.slice(MARK.length).split(";")[0] || undefined;
  return mark;
}

const RECOVERY = "recovery_mark";

/**
 * Names the recovery session just begun, until `expiresAt`: in the
 * readable `recovery_mark` cookie, set with the session's own, and in the
 * body, for the tab that began it. A recovery session has no display
 * cookies (AU-9), so this is how a tab tells its own recovery from one
 * another tab began since (PF-5). Random, as the recovery's step needs no
 * more than to tell one from another. Display only; the HttpOnly session
 * authorizes.
 */
export function markRecovery(context: Context, expiresAt: number) {
  const mark = randomToken(12);
  const age = Math.max(0, Math.floor((expiresAt - context.now) / 1000));
  context.cookies.push(
    `${RECOVERY}=${mark}; Max-Age=${age}; Path=/; Secure; SameSite=Lax`,
  );
  return mark;
}

/**
 * Clears the recovery's name with the answer that begins a normal session
 * (a login, a registration, a recovery's registration) or ends one (a
 * logout, a deletion): it lives no longer than the recovery it names, so
 * no tab takes it for one the browser still holds (AU-6).
 */
export function forgetRecovery(context: Context) {
  context.cookies.push(`${RECOVERY}=; Max-Age=0; Path=/; Secure; SameSite=Lax`);
}
