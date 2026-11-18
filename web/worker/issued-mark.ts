import type { Context } from "./app";

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
