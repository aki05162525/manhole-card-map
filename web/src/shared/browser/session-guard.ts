import { ApiError, isApiError } from "./api";
import {
  forgetSignedIn,
  recoveryMark,
  sessionMark,
  signedIn,
} from "./signed-in";

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
 * sets those of the session it begins, and names it in its body
 * (`begunMark`). Every other answer leaves them.
 */
export type SessionChange = "end" | "begin";

/** The one owner a view keeps, if any (`sessionGuard`). */
export type GuardOwner = { mark?: string | null; recovery?: string };

// Whose the display cookies are now: a session mark, or null signed out.
const owner = () => (signedIn() ? sessionMark() : null);

/**
 * The session an answer that begins one names in its body (`sessionMark`,
 * the value its cookies set), or undefined. What it holds is for that
 * session only: by the time it is read, the cookies may name another.
 */
export function begunMark(value: unknown) {
  if (typeof value !== "object" || value === null || !("sessionMark" in value))
    return undefined;
  return typeof value.sessionMark === "string" ? value.sessionMark : undefined;
}

/**
 * How long what the private API last answered a view stands for the
 * server's word on a return. The display cookies outlive the session the
 * Worker keeps: it ends an inactive one after 30 days on its own, and a
 * recovery or a deletion on another device ends it at any time, all
 * without a word to this page. A view an hour past its last answer (or
 * start) hides what it shows on a return (the tab shown, not hidden) and
 * asks again: one read per shown view and return (the records' list, and
 * the detail's memo when a card is open), after an hour without one.
 */
export const DORMANT_MS = 60 * 60 * 1000;

/**
 * The one check between a view of one user's private data (the records,
 * a friend's map, the friends, the account's settings) and the private API.
 * The view belongs to the user whose session mark it began with; `restart()`
 * makes it whoever is signed in now and moves the epoch on. `send` asks only
 * while the cookies still name that user and the view is open, and drops
 * whatever comes back after a restart or a close, or once the cookies name
 * someone else, failures and 401 included (PF-5): another tab may sign in or
 * out before this page hears of it. Signed out by then (another tab's
 * logout), an answer is passed on only as the end it asked for (`"end"`,
 * whose own answer clears the display cookies), and a failure only as a
 * 401, the end of this session; any other is the user's before and comes
 * back `signed-out`. No 401 is relied on to clear a cookie with its answer:
 * the screen that gets it from here forgets the display cookies
 * (`sendGuarded`), and only a logout or a deletion clears them itself. The mark
 * only decides what to show; the HttpOnly session authorizes the request.
 * `dormant()` tells a view to ask again on a return (`DORMANT_MS`).
 *
 * A view may be for one owner only, kept as it starts again: `mark`, one
 * session (the screen that closes on a change instead of showing the next
 * user), or `recovery`, the step of one recovery (its `recoveryMark`). A
 * recovery session has no display cookies (AU-9), so that view is current
 * only while there are none and `recovery_mark` names that recovery: a
 * session showing in them is a sign-in (in this tab or another), and
 * another name another tab's recovery, whose session has replaced this
 * one's. Nothing is sent or taken for the recovery then. Its registration
 * (`"begin"`) succeeds only as the session it began, the one its answer
 * names (`begunMark`) and the cookies hold as it comes in, never by the
 * recovery's own test; from then on the view is that session's.
 */
export function sessionGuard({ mark, recovery }: GuardOwner = {}) {
  let recovering = recovery !== undefined;
  // Kept on a restart: once the cookies name another, the view is over.
  const fixed = recovering || mark !== undefined;
  let view = {
    owner: recovering ? null : mark !== undefined ? mark : owner(),
    epoch: 0,
  };
  let closed = false;
  let abort = new AbortController();
  // When the view last began, or had an answer passed on.
  let heard = Date.now();
  // Whether the cookies are still this view's; `now` is `owner()`.
  const holds = (now: string | null) =>
    recovering
      ? now === null && recoveryMark() === recovery
      : now !== null && now === view.owner;
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
      view = { owner: fixed ? view.owner : owner(), epoch: view.epoch + 1 };
      heard = Date.now();
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
      heard = Date.now();
    },
    /** Whether the cookies still name this view's user. */
    current: () => holds(owner()),
    /**
     * Whether what the view shows is older than `DORMANT_MS`: on a return
     * it hides that and starts again. Never for a recovery, which shows
     * nothing of the user's.
     */
    dormant: () => !recovering && Date.now() - heard >= DORMANT_MS,
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
      const dropped = (outcome: { error: unknown } | { value: T }) => {
        if (epoch !== view.epoch) return stale;
        const now = owner();
        if (recovering && change === "begin" && "value" in outcome) {
          if (now === null || begunMark(outcome.value) !== now)
            return changedSince;
          recovering = false;
          view = { owner: now, epoch };
          return null;
        }
        if (holds(now)) return null;
        if (now === null && !recovering)
          return (
            "error" in outcome
              ? isApiError(outcome.error, 401)
              : change === "end"
          )
            ? null
            : signedOutSince;
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
      const drop = dropped({ value });
      if (drop) return drop;
      heard = Date.now();
      return { kind: "answer", value };
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
 * not sent, or answered, without a session fails as a 401. The guard passes
 * on only this view's failures, so a 401 that reaches here is this user's
 * session ended (inactive, or ended elsewhere) and forgets the display
 * cookies here, not left to the 401's answer; one answered as another
 * user's is that change. A recovery's 401 is passed on only while the
 * display cookies stay as the step began (none): its step has expired, and
 * no session's cookies are forgotten.
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
