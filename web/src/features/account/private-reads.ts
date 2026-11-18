import { ApiError } from "../../shared/browser/api";
import {
  sendGuarded,
  sessionGuard,
  UserChanged,
} from "../../shared/browser/session-guard";
import {
  onPageReturn,
  sessionMark,
  signedIn,
} from "../../shared/browser/signed-in";
import { api, type PrivateApi } from "./account-api";

/**
 * What the friends and the account's settings last read, kept in memory for
 * the rest of the document so a return draws at once (PF-5: never in
 * storage or history). Each read belongs to the session it was read with
 * and is gone once the cookies name another (a logout, a 401, a deletion,
 * another user). Only reads, and what a write answered changes of them
 * (`amend`): the invitation's link is part of the friends' read, a new one
 * included. Recovery codes and anything halfway stay with the screen that
 * showed them.
 */
type Entry = {
  mark: string;
  value?: unknown;
  // Read ahead of the screen and not yet shown: the screen takes it as its
  // own read instead of asking again.
  ahead?: boolean;
  pending?: Promise<unknown>;
};
const entries = new Map<string, Entry>();
const owner = () => (signedIn() ? sessionMark() : null);
let watching = false;
function watch() {
  if (watching) return;
  watching = true;
  onPageReturn(() => {
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
  return found;
}
/**
 * One request per path and session at a time. Its answer is kept and given
 * only while the cookies still name the session it was asked for; another
 * user signed in, or none, by then, it fails as their screens' guard would.
 */
function shared(path: string, ahead: boolean) {
  const found = entry(path);
  if (!found) return Promise.reject(new Error("signed out"));
  if (found.pending) return found.pending;
  const pending = api(path).then((value) => {
    const now = owner();
    if (now === null) throw new ApiError(401, "unauthorized");
    if (now !== found.mark) throw new UserChanged(true);
    if (entries.get(path) === found) {
      found.value = value;
      found.ahead = ahead;
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
export function remembered<T>(path: string): T | null {
  const found = entry(path);
  return found && "value" in found ? (found.value as T) : null;
}
/**
 * Reads `path` as `session`'s screen. With `fresh: false` (entering the
 * screen) a read still on its way is joined, and one read ahead and not yet
 * shown is taken as it is. Otherwise the read follows a write and begins
 * after it: one begun earlier may not show the write, so it is waited for
 * and not taken as the answer.
 */
export function readPrivate<T>(
  session: PrivateApi,
  path: string,
  { fresh = true } = {},
): Promise<T> {
  // Waited for outside the guard, so a screen left meanwhile sends nothing.
  const earlier = fresh ? entry(path)?.pending : undefined;
  return (earlier?.catch(() => {}) ?? Promise.resolve()).then(() =>
    read<T>(session, path, fresh, earlier),
  );
}
function read<T>(
  session: PrivateApi,
  path: string,
  fresh: boolean,
  earlier: Promise<unknown> | undefined,
) {
  return session.send(async () => {
    const found = entry(path);
    if (!fresh && found?.ahead && !found.pending) {
      found.ahead = false;
      return found.value as T;
    }
    if (earlier && found?.pending === earlier) delete found.pending;
    const value = (await shared(path, false)) as T;
    // Joined a read started ahead: this screen has it now.
    const now = entries.get(path);
    if (now) now.ahead = false;
    return value;
  });
}
/** Changes the kept read of `path` after a write answered with its result. */
export function amend<T>(path: string, change: (value: T) => T) {
  const found = entry(path);
  if (found && "value" in found) found.value = change(found.value as T);
}
/**
 * Starts reading `path` before its screen is shown, signed in only (PF-1),
 * through a guard of its own: nothing is asked again while a read is on its
 * way or one read ahead waits.
 */
export function readAhead(path: string) {
  const found = entry(path);
  if (!found || found.pending || found.ahead) return;
  void sendGuarded(sessionGuard(), () => shared(path, true)).catch(() => {});
}
