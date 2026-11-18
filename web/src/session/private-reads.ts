import { ApiError, InvalidAnswer, isApiError } from "./api";
import {
  DORMANT_MS,
  sendGuarded,
  sessionGuard,
  UserChanged,
  type Owner,
} from "./session-guard";
import { onPageReturn, sessionMark, signedIn } from "./signed-in";
import { api, type Operation, type PrivateApi } from "./account-api";
import type { PrivateRead } from "../contract/private-api";

/**
 * What the friends and the account's settings last read, kept in memory for
 * the rest of the document so a return draws at once (PF-5: never in
 * storage or history). Each read belongs to the session it was read with
 * and is gone once the cookies name another (a logout, a 401, a deletion,
 * another user), or once it is older than `DORMANT_MS`: the session may
 * have ended on the Worker's side since, so it is not drawn, even while a
 * read on its way is shared. Only reads that passed their check
 * (`PrivateRead`), and what a write answered changes of them
 * (`amend`): the invitation's link is part of the friends' read, a new one
 * included. Recovery codes and anything halfway stay with the screen that
 * showed them.
 */
type Entry = {
  mark: string;
  value?: unknown;
  // When `value` was answered.
  at?: number;
  // Read ahead of the screen and not yet shown: the screen takes it as its
  // own read instead of asking again.
  ahead?: boolean;
  pending?: Promise<unknown>;
};
const entries = new Map<string, Entry>();
const owner = () => (signedIn() ? sessionMark() : null);
// A read ahead refused as a recovery's session's (403 `recovery_session`),
// as its guard took it as its owner's and forgot the display cookies left:
// the settings opened next say why, once (`refusedAhead`). Dropped once a
// user signs in: what they open is theirs.
let refused = false;
let watching = false;
function watch() {
  if (watching) return;
  watching = true;
  onPageReturn(() => {
    if (signedIn()) refused = false;
    for (const [path, entry] of entries)
      if (entry.mark !== owner()) entries.delete(path);
  });
}
function entry(path: string) {
  watch();
  const mark = owner();
  if (mark === null) {
    entries.clear();
    return null;
  }
  let found = entries.get(path);
  if (found?.mark !== mark) entries.set(path, (found = { mark }));
  else if (found.at !== undefined && Date.now() - found.at >= DORMANT_MS) {
    // Too old to draw, though a read on its way is still shared.
    delete found.value;
    delete found.at;
    found.ahead = false;
  }
  return found;
}
/**
 * One request per path and session at a time. Its answer is kept and given
 * only while the cookies still name the session it was asked for; another
 * user signed in, or none, by then, it fails as their screens' guard would.
 */
function shared<T>({ path, read }: PrivateRead<T>, ahead: boolean) {
  const found = entry(path);
  if (!found) return Promise.reject(new Error("signed out"));
  // Begun by a read of the same path: the same check.
  if (found.pending)
    return found.pending.then((value) => {
      if (!read(value)) throw new InvalidAnswer(path);
      return value;
    });
  const pending = api(path, { read }).then((value) => {
    const now = owner();
    if (now === null) throw new ApiError(401, "unauthorized");
    if (now !== found.mark) throw new UserChanged(true);
    if (entries.get(path) === found) {
      found.value = value;
      found.ahead = ahead;
      found.at = Date.now();
    }
    return value;
  });
  found.pending = pending;
  void pending
    .catch(() => {})
    .finally(() => {
      if (found.pending === pending) delete found.pending;
    });
  return pending;
}

/** The last read of `path` for the user signed in now, or null. */
export function remembered<T>({ path, read }: PrivateRead<T>): T | null {
  const value = entry(path)?.value;
  return read(value) ? value : null;
}
/**
 * Reads `path` as the operation's owner. With `fresh: false` (entering the
 * screen) a read still on its way is joined, and one read ahead and not yet
 * shown is taken as it is. Otherwise the read follows a write and begins
 * after it: one begun earlier may not show the write, so it is waited for
 * and not taken as the answer.
 */
export function readPrivate<T>(
  operation: Operation,
  request: PrivateRead<T>,
  { fresh }: { fresh: boolean },
): Promise<T> {
  // Waited for outside the guard, so a screen left meanwhile sends nothing.
  const earlier = fresh ? entry(request.path)?.pending : undefined;
  return (earlier?.catch(() => {}) ?? Promise.resolve()).then(() =>
    readOnce(operation, request, fresh, earlier),
  );
}
function readOnce<T>(
  operation: Operation,
  request: PrivateRead<T>,
  fresh: boolean,
  earlier: Promise<unknown> | undefined,
) {
  const { path, read } = request;
  return operation.send(async () => {
    const found = entry(path);
    if (!fresh && found?.ahead && !found.pending && read(found.value)) {
      found.ahead = false;
      return found.value;
    }
    if (earlier && found?.pending === earlier) delete found.pending;
    const value = await shared(request, false);
    // Joined a read started ahead: this screen has it now.
    const now = entries.get(path);
    if (now) now.ahead = false;
    return value;
  });
}
/**
 * Changes the kept read of `path` with what a write taken as `owner`
 * answered, only while the screen `view` still holds that owner, its epoch
 * included (`holds`, checked here as the read is changed): false once it
 * does not, and the answer is not the screen's to show or hand on either.
 */
export function amend<T>(
  view: Pick<PrivateApi, "holds">,
  owner: Owner,
  { path, read }: PrivateRead<T>,
  change: (value: T) => T,
) {
  if (!view.holds(owner)) return false;
  const found = entry(path);
  if (found?.mark === owner.mark && read(found.value))
    found.value = change(found.value);
  return true;
}
/**
 * Starts reading `path` before its screen is shown, signed in only (PF-1),
 * through a guard of its own: nothing is asked again while a read is on its
 * way or one read ahead waits.
 */
export function readAhead<T>(request: PrivateRead<T>) {
  const found = entry(request.path);
  if (!found || found.pending || found.ahead) return;
  void sendGuarded(sessionGuard(), () => shared(request, true)).catch(
    (error: unknown) => {
      // Passed on by the guard only as the owner's, the cookies still
      // theirs as it came back (another user's is `UserChanged`).
      if (isApiError(error, 403, "recovery_session")) refused = true;
    },
  );
}
/**
 * Whether a read ahead was refused as a recovery's session's since the
 * settings last opened, and no user has signed in since: the screen that
 * opens says why (no side effect, for its first view; `forgetRefusedAhead`
 * once it has opened).
 */
export const refusedAhead = () => refused && !signedIn();
/** The settings have opened: the refusal read ahead is told no more. */
export function forgetRefusedAhead() {
  refused = false;
}
