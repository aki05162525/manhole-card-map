import { useEffect, useRef, useState } from "react";
import { apiFailure, apiFetch } from "../../shared/browser/api";
import {
  begunMark,
  sendGuarded,
  sessionGuard,
  UserChanged,
  type GuardOwner,
  type SessionChange,
} from "../../shared/browser/session-guard";
import {
  onPageReturn,
  recoveryMark,
  sessionMark,
  signedIn,
} from "../../shared/browser/signed-in";

export { ApiError, isApiError } from "../../shared/browser/api";
export { Dropped, UserChanged } from "../../shared/browser/session-guard";

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

type Options = NonNullable<Parameters<typeof api>[1]>;
/**
 * A request whose answer begins a session (a registration): its value, and
 * the mark of the session it began, as its body names it (`begunMark`).
 * Fails with `UserChanged(true)` unless the cookies name that session once
 * the answer is read: another tab's sign-in may have replaced its cookies,
 * and what it holds is then not for whoever is signed in.
 */
export async function beginSession<T>(path: string, body: unknown) {
  const response = await apiFetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw await apiFailure(response);
  const value = (await response.json()) as T;
  const mark = begunMark(value);
  if (mark === undefined || !signedIn() || sessionMark() !== mark)
    throw new UserChanged(true);
  return { value, mark };
}

/** The private API of one view: `api` through its session guard. */
export type PrivateApi = {
  /** With `change`, an answer that changes the display cookies itself. */
  api<T = unknown>(
    path: string,
    options?: Options & { change?: SessionChange },
  ): Promise<T>;
  /** Any request of this view, as `api` sends its own (a shared read). */
  send<T>(request: () => Promise<T>): Promise<T>;
  /** The mark of the session the view is for: what it shows is theirs. */
  readonly mark: string | null;
  /** Starts the view again as `onUser` does on a return. */
  restart(): void;
  /** Aborted when the view is left, for the passkey prompt it waits on. */
  readonly signal: AbortSignal;
};

/**
 * The private API of a screen of one user's data (the friends, the
 * account's settings), as the records go through theirs: sent only while
 * the screen is shown and the cookies name the user it began with; answers
 * and failures that come back after the screen is left or starts again are
 * dropped (`Dropped`), a 401 forgets the session only for this user, and
 * one answered after another tab's logout fails as a 401 (unless it was
 * the logout or deletion itself, sent with `change: "end"`).
 * Another user signed in (seen on a return, or by a request not sent or
 * answered since, which fails with `UserChanged`), a logout, or a return
 * an hour after the screen's last answer (`DORMANT_MS`) starts the screen
 * again: `onUser` clears what it showed and reads it anew.
 * `mark` keeps the screen to one session (the recovery's last screen),
 * and `recovery` to the one step of a recovery session, which has no
 * display cookies, named by its `recoveryMark` (`sessionGuard`): once the
 * cookies name another, as the screen begins or later, `onUser` ends it.
 * A recovery's registration that began a session makes the step that
 * session's, as it names it.
 */
export function usePrivateApi(
  onUser: () => void = () => {},
  only: GuardOwner = {},
): PrivateApi {
  const [guard] = useState(() => sessionGuard(only));
  // One session's or recovery's: it ends rather than moving to another.
  const fixed = only.mark !== undefined || only.recovery !== undefined;
  const latest = useRef(onUser);
  latest.current = onUser;
  const [session] = useState(() => {
    const restart = () => {
      guard.restart();
      latest.current();
    };
    const send = async <T>(
      request: () => Promise<T>,
      change?: SessionChange,
    ) => {
      try {
        return await sendGuarded(guard, request, change);
      } catch (error) {
        if (error instanceof UserChanged) restart();
        throw error;
      }
    };
    return {
      restart,
      send: <T>(request: () => Promise<T>) => send(request),
      api: <T = unknown>(
        path: string,
        { change, ...options }: Options & { change?: SessionChange } = {},
      ) => send(() => api<T>(path, options), change),
      get mark() {
        return guard.mark;
      },
      get signal() {
        return guard.signal;
      },
    };
  });
  useEffect(() => {
    guard.open();
    // Begun once the cookies name another (a recovery step while a session
    // shows): not that one's screen.
    if (fixed && !guard.current()) session.restart();
    const cookies = () => `${signedIn()} ${sessionMark()} ${recoveryMark()}`;
    let seen = cookies();
    const stop = onPageReturn(() => {
      const now = cookies();
      const moved = now !== seen;
      seen = now;
      // Back an hour after the last answer: the session may have ended
      // on the Worker's side alone, so what is shown is read again.
      if ((moved && !guard.current()) || guard.dormant()) session.restart();
    });
    return () => {
      stop();
      guard.close();
    };
  }, [guard, session, fixed]);
  return session;
}
