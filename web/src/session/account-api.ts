import { useEffect, useLayoutEffect, useState } from "react";
import type { Guard } from "../contract/shape";
import { answerOf, apiFailure, apiFetch } from "./api";
import {
  begunMark,
  sendGuarded,
  sessionGuard,
  UserChanged,
  type GuardFor,
  type Owned,
  type Owner,
  type SessionChange,
} from "./session-guard";
import { onPageReturn, recoveryMark, sessionMark, signedIn } from "./signed-in";

export { ApiError, isApiError } from "./api";
export { Dropped, UserChanged } from "./session-guard";

type Options = { method?: string; body?: unknown };
type Reading<T> = Options & { read: Guard<T> };

/**
 * A same-origin JSON call. Failures carry the Worker's `{ error }` code
 * (`ApiError`). With `read`, the operation answers with a body, and it is
 * taken only once it has that shape (`InvalidAnswer` otherwise); without,
 * any success is the answer and its body is not read.
 */
export function api<T>(path: string, options: Reading<T>): Promise<T>;
export function api(path: string, options?: Options): Promise<void>;
export async function api<T>(
  path: string,
  { method, body, read }: Options & { read?: Guard<T> } = {},
): Promise<T | void> {
  const response = await apiFetch(path, {
    method: method ?? (body === undefined ? "GET" : "POST"),
    ...(body !== undefined && {
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  });
  if (!response.ok) throw await apiFailure(response);
  if (read) return answerOf(response, path, read);
}

/**
 * A request whose answer begins a session (a registration): its value, and
 * the mark of the session it began, as its body names it (`begunMark`).
 * Fails with `UserChanged(true)` unless the cookies name that session once
 * the answer is read: another tab's sign-in may have replaced its cookies,
 * and what it holds is then not for whoever is signed in.
 */
export async function beginSession<T>(
  path: string,
  body: unknown,
  read: Guard<T>,
) {
  const response = await apiFetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw await apiFailure(response);
  const value = await answerOf(response, path, read);
  const mark = begunMark(value);
  if (mark === undefined || !signedIn() || sessionMark() !== mark)
    throw new UserChanged(true);
  return { value, mark };
}

type Sent = Options & { change?: SessionChange };
/**
 * One operation of a view (a read, a write, a passkey check and what it
 * allows, a reissue): every request of it is its owner's, the one the view
 * had as it began, to its end. Once the view has a new owner (another user
 * seen, a return an hour later) or is left, nothing more of it is sent and
 * nothing that comes back is taken.
 */
export type Operation = {
  readonly owner: Owner;
  /**
   * `api`, as the operation's owner. With `change`, an answer that changes
   * the display cookies itself.
   */
  api<T>(path: string, options: Sent & { read: Guard<T> }): Promise<T>;
  api(path: string, options?: Sent): Promise<void>;
  /**
   * `api` of an answer with a body, with the owner it was taken for: the
   * operation's, or the session a recovery's registration began
   * (`change: "begin"`).
   */
  owned<T>(path: string, options: Sent & { read: Guard<T> }): Promise<Owned<T>>;
  /** Any request of the operation, as `api` sends its own (a shared read). */
  send<T>(request: () => Promise<T>): Promise<T>;
  /** Aborted once the owner is not the view's: for the passkey prompt. */
  readonly signal: AbortSignal;
};

/** The private API of one view: its operations, through its session guard. */
export type PrivateApi = {
  /** Begins an operation as the view's owner now. */
  operation(): Operation;
  /** Whose an operation begun now is. */
  readonly owner: Owner;
  /**
   * Whether what was read as `owner` may be drawn: it is the view's owner
   * (its epoch too), the screen is shown, and the cookies name it. No side
   * effect, for a render: what it hides is read again once a press, an
   * answer or a return finds the change (`holds`).
   */
  shows(owner: Owner): boolean;
  /**
   * `shows`, for what is about to be kept, handed on or taken out of the
   * page (copied, shared, another screen): once the cookies name another,
   * the view starts again as `onUser` does on a return, and nothing is
   * taken.
   */
  holds(owner: Owner): boolean;
  /** Starts the view again as `onUser` does on a return. */
  restart(): void;
  /** What a restart calls from now on (`useOnUser`). */
  listen(onUser: () => void): void;
};

/**
 * The private API of a screen of one user's data (the friends, the
 * account's settings), as the records go through theirs: each operation is
 * sent only while the screen is shown and the cookies name the owner it
 * began with; answers and failures that come back after the screen is left
 * or starts again are dropped (`Dropped`), a 401 forgets the session only
 * for this user (in the guard, as it is checked), and one answered after
 * another tab's logout fails as a 401 (unless it was the logout or
 * deletion itself, sent with `change: "end"`, which ends the screen: the
 * guard tells every screen of it, and the caller moves on). Another user
 * signed in
 * (seen on a return, or by a request not sent or answered since, which
 * fails with `UserChanged`), a logout, or a return an hour after the
 * screen's last answer (`DORMANT_MS`) starts the screen again with a new
 * owner: `onUser` (`useOnUser`) clears what it showed and reads it anew.
 * `mark` keeps the screen to one session (the recovery's last screen),
 * and `recovery` to the one step of a recovery session, which has no
 * display cookies, named by its `recoveryMark` (`sessionGuard`): once the
 * cookies name another, as the screen begins or later, `onUser` ends it.
 * A recovery's registration that began a session answers as that session,
 * and the step is its from then on.
 */
export function usePrivateApi(only: GuardFor = {}): PrivateApi {
  const [guard] = useState(() => sessionGuard(only));
  // One session's or recovery's: it ends rather than moving to another. As
  // the guard is, whose it is was decided by the first render.
  const [fixed] = useState(
    () => only.mark !== undefined || only.recovery !== undefined,
  );
  const [session] = useState((): PrivateApi => {
    let onUser = () => {};
    const restart = () => {
      guard.restart();
      onUser();
    };
    const operation = (): Operation => {
      const { owner, signal } = guard;
      const owned = async <T>(
        request: () => Promise<T>,
        change?: SessionChange,
      ) => {
        try {
          return await sendGuarded(guard, request, change, owner);
        } catch (error) {
          // The view's owner still, but not the cookies': it starts again.
          if (error instanceof UserChanged && guard.owner === owner) restart();
          throw error;
        }
      };
      function call<T>(
        path: string,
        options: Sent & { read: Guard<T> },
      ): Promise<T>;
      function call(path: string, options?: Sent): Promise<void>;
      async function call<T>(
        path: string,
        { change, read, ...options }: Sent & { read?: Guard<T> } = {},
      ) {
        const request = () =>
          read ? api(path, { ...options, read }) : api(path, options);
        return (await owned<T | void>(request, change)).value;
      }
      return {
        owner,
        signal,
        send: async <T>(request: () => Promise<T>) =>
          (await owned(request)).value,
        owned: <T>(
          path: string,
          { change, ...options }: Sent & { read: Guard<T> },
        ) => owned(() => api(path, options), change),
        api: call,
      };
    };
    return {
      operation,
      restart,
      listen(next) {
        onUser = next;
      },
      get owner() {
        return guard.owner;
      },
      shows: (owner) => guard.owns(owner),
      holds(owner) {
        if (guard.owns(owner)) return true;
        if (guard.owner === owner && !guard.current()) restart();
        return false;
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
      // Ended by its own end (a logout, a deletion): the screen moves on.
      if (guard.closed) return;
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

/**
 * What the view does as it starts again with a new owner (`usePrivateApi`):
 * the `onUser` of the latest render committed, so it may use what the
 * component declares after its session. Set before the view opens.
 */
export function useOnUser(session: PrivateApi, onUser: () => void) {
  useLayoutEffect(() => session.listen(onUser));
}
