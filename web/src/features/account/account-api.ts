import { useEffect, useRef, useState } from "react";
import { apiFailure, apiFetch } from "../../shared/browser/api";
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

/** The private API of one view: `api` through its session guard. */
export type PrivateApi = {
  api: typeof api;
  /** Aborted when the view is left, for the passkey prompt it waits on. */
  readonly signal: AbortSignal;
};

/**
 * The private API of a screen of one user's data (the friends, the
 * account's settings), as the records go through theirs: sent only while
 * the screen is shown and the cookies name the user it began with; answers
 * and failures that come back after the screen is left or the user changes
 * are dropped (`Dropped`), a 401 forgets the session only for this user.
 * Another user signed in (seen on a return, or by a request not sent, which
 * fails with `UserChanged`) or a logout starts the screen again: `onUser`
 * clears what it showed and reads it anew. `recovery` is for the one step
 * of a recovery session, which has no display cookies.
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
    const call = (async (path, options) => {
      try {
        return await sendGuarded(guard, () => api(path, options));
      } catch (error) {
        if (error instanceof UserChanged) restart();
        throw error;
      }
    }) as typeof api;
    return {
      restart,
      api: call,
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
