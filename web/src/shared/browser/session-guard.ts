import { ApiError, isApiError } from "./api";
import { forgetSignedIn, sessionMark, signedIn } from "./signed-in";

/** What became of a private request sent through a guard. */
export type Guarded<T> =
  | { kind: "answer"; value: T }
  /** Not sent: no session now. */
  | { kind: "signed-out" }
  /** Not sent: another user has signed in since the view began. */
  | { kind: "changed" }
  /**
   * Sent before the view started again, or not sent because the view is
   * closed; its answer or failure is not this view's.
   */
  | { kind: "stale" };

/**
 * The one check between a view of one user's private data (the records,
 * a friend's map, the friends, the account's settings) and the private API.
 * The view belongs to the user whose session mark it began with; `restart()`
 * makes it whoever is signed in now and moves the epoch on. `send` asks only
 * while the cookies still name that user and the view is open, and drops
 * whatever comes back after a restart or a close, failures and 401
 * included. The mark only decides what to show; the HttpOnly session
 * authorizes the request. A recovery session has no display cookies (AU-9):
 * with `recovery`, only the view's being open and its epoch count.
 */
export function sessionGuard({ recovery = false } = {}) {
  let view = { mark: sessionMark(), epoch: 0 };
  let closed = false;
  let abort = new AbortController();
  return {
    get epoch() {
      return view.epoch;
    },
    /** Aborted when the view closes: for a passkey prompt it is waiting on. */
    get signal() {
      return abort.signal;
    },
    restart() {
      view = { mark: sessionMark(), epoch: view.epoch + 1 };
    },
    /** The view is gone (its screen left): nothing more is sent for it. */
    close() {
      closed = true;
      abort.abort();
      view = { ...view, epoch: view.epoch + 1 };
    },
    /** Shown again, as React mounts a component twice in development. */
    open() {
      if (!closed) return;
      closed = false;
      abort = new AbortController();
    },
    /** Whether the cookies still name this view's user. */
    current: () => recovery || (signedIn() && sessionMark() === view.mark),
    async send<T>(request: () => Promise<T>): Promise<Guarded<T>> {
      if (closed) return stale;
      if (!recovery && !signedIn()) return { kind: "signed-out" };
      if (!recovery && sessionMark() !== view.mark) return { kind: "changed" };
      const { epoch } = view;
      try {
        const value = await request();
        return epoch === view.epoch ? { kind: "answer", value } : stale;
      } catch (error) {
        if (epoch !== view.epoch) return stale;
        throw error;
      }
    },
  };
}
const stale = { kind: "stale" } as const;
export type SessionGuard = ReturnType<typeof sessionGuard>;

/** A request not sent, or answered, for this view's user: drop it unseen. */
export class Dropped extends Error {}
/** Not sent: another user is signed in now. The view starts again. */
export class UserChanged extends Error {}

/**
 * `guard.send` for a caller that wants the answer or an error: a request
 * not sent without a session fails as a 401. A 401 forgets the display
 * cookies only while they still name this view's user; signed in as another
 * user since, it is that change instead.
 */
export async function sendGuarded<T>(
  guard: SessionGuard,
  request: () => Promise<T>,
): Promise<T> {
  let sent: Guarded<T>;
  try {
    sent = await guard.send(request);
  } catch (error) {
    if (isApiError(error, 401)) {
      if (signedIn() && !guard.current()) throw new UserChanged();
      forgetSignedIn();
    }
    throw error;
  }
  if (sent.kind === "answer") return sent.value;
  if (sent.kind === "signed-out") throw new ApiError(401, "unauthorized");
  if (sent.kind === "changed") throw new UserChanged();
  throw new Dropped();
}
