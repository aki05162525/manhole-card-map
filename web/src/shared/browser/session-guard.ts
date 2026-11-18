import { ApiError, isApiError } from "./api";
import { forgetSignedIn, sessionMark, signedIn } from "./signed-in";

/** What became of a private request sent through a guard. */
export type Guarded<T> =
  | { kind: "answer"; value: T }
  /** Not sent: no session now. */
  | { kind: "signed-out" }
  /**
   * Another user has signed in since the view began: not sent, or (`sent`)
   * answered or failed after the change, and so dropped as not theirs.
   */
  | { kind: "changed"; sent: boolean }
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
 * whatever comes back after a restart or a close, or once the cookies name
 * another user, failures and 401 included (PF-5): another tab may sign in
 * before this page hears of it. An answer that comes back signed out is
 * passed on, since a logout, a deletion and a 401 clear the display cookies
 * with the answer itself. The mark only decides what to show; the HttpOnly
 * session authorizes the request. A recovery session has no display
 * cookies (AU-9): with `recovery`, only the view's being open and its epoch
 * count.
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
      if (!recovery && sessionMark() !== view.mark)
        return { kind: "changed", sent: false };
      const { epoch } = view;
      // Whether what came back is still this view's.
      const dropped = () =>
        epoch !== view.epoch
          ? stale
          : !recovery && signedIn() && sessionMark() !== view.mark
            ? changedSince
            : null;
      let value: T;
      try {
        value = await request();
      } catch (error) {
        const drop = dropped();
        if (drop) return drop;
        throw error;
      }
      return dropped() ?? { kind: "answer", value };
    },
  };
}
const stale = { kind: "stale" } as const;
const changedSince = { kind: "changed", sent: true } as const;
export type SessionGuard = ReturnType<typeof sessionGuard>;

/** A request not sent, or answered, for this view's user: drop it unseen. */
export class Dropped extends Error {}
/**
 * Another user is signed in now: not sent, or (`sent`) its outcome dropped
 * as the user's before. The view starts again.
 */
export class UserChanged extends Error {
  constructor(readonly sent = false) {
    super();
  }
}
/** What a screen that starts again says of a `UserChanged`. */
export const userChangedMessage = ({ sent }: UserChanged) =>
  sent
    ? "送信の途中でほかのタブの利用者が替わったため、結果を確かめられませんでした。表示を読み込み直しています。"
    : "ほかのタブで利用者が替わったため、送りませんでした。表示を読み込み直しています。";

/**
 * `guard.send` for a caller that wants the answer or an error: a request
 * not sent without a session fails as a 401. The guard passes on only this
 * view's failures, so a 401 that reaches here is this user's and forgets
 * the display cookies; one answered as another user's is that change.
 */
export async function sendGuarded<T>(
  guard: SessionGuard,
  request: () => Promise<T>,
): Promise<T> {
  let sent: Guarded<T>;
  try {
    sent = await guard.send(request);
  } catch (error) {
    if (isApiError(error, 401)) forgetSignedIn();
    throw error;
  }
  if (sent.kind === "answer") return sent.value;
  if (sent.kind === "signed-out") throw new ApiError(401, "unauthorized");
  if (sent.kind === "changed") throw new UserChanged(sent.sent);
  throw new Dropped();
}
