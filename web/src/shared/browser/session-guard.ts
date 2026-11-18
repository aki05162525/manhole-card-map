import { ApiError, isApiError } from "./api";
import { forgetSignedIn, sessionMark, signedIn } from "./signed-in";

/** What became of a private request sent through a guard. */
export type Guarded<T> =
  | { kind: "answer"; value: T }
  /** No session now: not sent, or answered after another tab's logout. */
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
 * A request whose own answer changes the display cookies: `"end"` (a
 * logout, a deletion) clears them, `"begin"` (a recovery's registration)
 * sets those of the session it begins. Every other answer leaves them.
 */
export type SessionChange = "end" | "begin";

// Whose the display cookies are now: a session mark, or null signed out.
const owner = () => (signedIn() ? sessionMark() : null);

/**
 * The one check between a view of one user's private data (the records,
 * a friend's map, the friends, the account's settings) and the private API.
 * The view belongs to the user whose session mark it began with; `restart()`
 * makes it whoever is signed in now and moves the epoch on. `send` asks only
 * while the cookies still name that user and the view is open, and drops
 * whatever comes back after a restart or a close, or once the cookies name
 * someone else, failures and 401 included (PF-5): another tab may sign in or
 * out before this page hears of it. Signed out by then, an answer is passed
 * on only as the end it asked for (`"end"`), and a failure only as a 401,
 * which clears the display cookies with the answer itself; any other is the
 * user's before and comes back `signed-out`. The mark only decides what to
 * show; the HttpOnly session authorizes the request.
 *
 * A recovery session has no display cookies (AU-9): with `recovery`, the
 * view is current while the display cookies stay as they were when it
 * began. A session showing up in them has replaced the recovery, and
 * nothing more is sent or taken for it, except the answer to the
 * recovery's own registration (`"begin"`), from which the guard is that
 * new session's.
 */
export function sessionGuard({ recovery = false } = {}) {
  let recovering = recovery;
  let view = { owner: owner(), epoch: 0 };
  let closed = false;
  let abort = new AbortController();
  // Whether the cookies are still this view's; `now` is `owner()`.
  const holds = (now: string | null) =>
    now === view.owner && (recovering || now !== null);
  return {
    get epoch() {
      return view.epoch;
    },
    /** The mark of the session this view is for, null for none. */
    get mark() {
      return view.owner;
    },
    /** Aborted when the view closes: for a passkey prompt it is waiting on. */
    get signal() {
      return abort.signal;
    },
    restart() {
      view = { owner: owner(), epoch: view.epoch + 1 };
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
    current: () => holds(owner()),
    async send<T>(
      request: () => Promise<T>,
      change?: SessionChange,
    ): Promise<Guarded<T>> {
      if (closed) return stale;
      const before = owner();
      if (!holds(before))
        return before === null && !recovering
          ? { kind: "signed-out" }
          : { kind: "changed", sent: false };
      const { epoch } = view;
      // What to make of the outcome once it is in: null passes it on.
      const dropped = (failure?: { error: unknown }) => {
        if (epoch !== view.epoch) return stale;
        const now = owner();
        if (holds(now)) return null;
        if (now === null) {
          if (recovering) return null;
          return (failure ? isApiError(failure.error, 401) : change === "end")
            ? null
            : signedOutSince;
        }
        if (recovering && change === "begin" && !failure) {
          recovering = false;
          view = { owner: now, epoch };
          return null;
        }
        return changedSince;
      };
      let value: T;
      try {
        value = await request();
      } catch (error) {
        const drop = dropped({ error });
        if (drop) return drop;
        throw error;
      }
      return dropped() ?? { kind: "answer", value };
    },
  };
}
const stale = { kind: "stale" } as const;
const changedSince = { kind: "changed", sent: true } as const;
const signedOutSince = { kind: "signed-out" } as const;
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
 * not sent, or answered, without a session fails as a 401. The guard passes on only this
 * view's failures, so a 401 that reaches here is this user's and forgets
 * the display cookies; one answered as another user's is that change.
 */
export async function sendGuarded<T>(
  guard: SessionGuard,
  request: () => Promise<T>,
  change?: SessionChange,
): Promise<T> {
  let sent: Guarded<T>;
  try {
    sent = await guard.send(request, change);
  } catch (error) {
    if (isApiError(error, 401)) forgetSignedIn();
    throw error;
  }
  if (sent.kind === "answer") return sent.value;
  if (sent.kind === "signed-out") throw new ApiError(401, "unauthorized");
  if (sent.kind === "changed") throw new UserChanged(sent.sent);
  throw new Dropped();
}
