import { useEffect, useRef, useState } from "react";
import { apiFailure, apiFetch } from "../../shared/browser/api";
import {
  sendGuarded,
  sessionGuard,
  UserChanged,
  type SessionChange,
} from "../../shared/browser/session-guard";
import {
  onPageReturn,
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
 * the mark of the session the answer's cookies name as it comes in. Fails
 * with `UserChanged(true)` once the cookies name another, or none, before
 * the answer is read: what it holds is then not for whoever is signed in.
 */
export async function beginSession<T>(path: string, body: unknown) {
  const response = await apiFetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const mark = signedIn() ? sessionMark() : null;
  if (!response.ok) throw await apiFailure(response);
  const value = (await response.json()) as T;
  if (mark === null || !signedIn() || sessionMark() !== mark)
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
 * answered since, which fails with `UserChanged`) or a logout starts the
 * screen again: `onUser` clears what it showed and reads it anew.
 * `recovery` is for the one step of a recovery session, which has no
 * display cookies: a session that shows up in them ends that step, with
 * `onUser`, unless it is the one the recovery's registration began.
 */
export function usePrivateApi(
  onUser: () => void = () => {},
  { recovery = false } = {},
): PrivateApi {
  const [guard] = useState(() => sessionGuard({ recovery }));
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
    let seen = `${signedIn()} ${sessionMark()}`;
    const stop = onPageReturn(() => {
      const now = `${signedIn()} ${sessionMark()}`;
      if (now === seen) return;
      seen = now;
      if (!guard.current()) session.restart();
    });
    return () => {
      stop();
      guard.close();
    };
  }, [guard, session]);
  return session;
}
