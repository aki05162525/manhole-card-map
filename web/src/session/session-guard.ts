import { ApiError, isApiError } from "./api";
import {
  forgetSignedIn,
  recoveryMark,
  sessionMark,
  signedIn,
} from "./signed-in";

/**
 * Whose one operation of a view is, from its start to its end: the session
 * (its mark), or one recovery's step (`recovery`, with no display cookies,
 * AU-9). Never changed: a view that starts again (`restart()`), or a
 * recovery whose registration begins a session, makes a new one, and what
 * was begun as the one before is not sent, taken or shown any more.
 */
export type Owner = {
  readonly mark: string | null;
  readonly recovery?: string;
  /** Moves on with each owner of the view. */
  readonly epoch: number;
};

/** What became of a private request sent through a guard. */
export type Guarded<T> =
  /** The answer, and the owner it was taken for. */
  | { kind: "answer"; value: T; owner: Owner }
  /** No session now: not sent, or answered after another tab's logout. */
  | { kind: "signed-out" }
  /**
   * Another user has signed in since the operation began: not sent, or
   * (`sent`) answered or failed after the change, and so dropped as not
   * theirs.
   */
  | { kind: "changed"; sent: boolean }
  /**
   * Begun as an owner the view has since replaced, or sent before the view
   * closed or not sent because it is closed; its outcome is not the view's.
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
export type GuardFor = { mark?: string | null; recovery?: string };

// Whose the display cookies are now: a session mark, or null signed out.
const signedInAs = () => (signedIn() ? sessionMark() : null);

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
 * The view's owner (`owner`) is the user whose session mark it began with,
 * and each operation keeps the owner it began with to its end: `send` asks
 * as that owner only while it is still the view's, the view is open and the
 * cookies name it, and drops whatever comes back once the view has a new
 * owner or closed, or once the cookies name someone else, failures and 401
 * included (PF-5): another tab may sign in or out before this page hears of
 * it. `restart()` gives the view a new owner, whoever is signed in now, and
 * changes no owner an operation holds. Signed out by then (another tab's
 * logout), an answer is passed on only as the end it asked for (`"end"`,
 * whose own answer clears the display cookies), and a failure only as a
 * 401, the end of this session; any other is the user's before and comes
 * back `signed-out`. The end of the owner's session is told here, in the
 * same step as the cookies are checked: a 401 passed on as theirs, or a
 * request that finds them signed out, forgets the display cookies
 * (`forgetSignedIn`, which tells every screen). No screen forgets them
 * for a 401 later, when the cookies may name another user, nor relies on
 * the 401's answer to clear them; only a logout or a deletion clears them
 * itself. The mark only decides what to show; the HttpOnly session
 * authorizes the request. `owns(owner)` tells whether what was got as
 * `owner` may still be shown, kept or taken out, and `dormant()` tells a
 * view to ask again on a return (`DORMANT_MS`).
 *
 * A view may be for one owner only, kept as it starts again: `mark`, one
 * session (the screen that closes on a change instead of showing the next
 * user), or `recovery`, the step of one recovery (its `recoveryMark`). A
 * recovery session has no display cookies (AU-9), so that view is current
 * only while there are none and `recovery_mark` names that recovery: a
 * session showing in them is a sign-in (in this tab or another), and
 * another name another tab's recovery, whose session has replaced this
 * one's. Nothing is sent or taken for the recovery then. Its end (`"end"`,
 * giving it up) clears its name with the answer, so it is passed on with
 * none. Its registration (`"begin"`) succeeds only as the session it began,
 * the one its answer names (`begunMark`) and the cookies hold as it comes
 * in, never by the recovery's own test; that session is the answer's owner,
 * and the view's from then on.
 */
export function sessionGuard({ mark, recovery }: GuardFor = {}) {
  // Kept on a restart: once the cookies name another, the view is over.
  const fixed = recovery !== undefined || mark !== undefined;
  let epoch = 0;
  const next = (mark: string | null, recovery?: string): Owner =>
    Object.freeze({
      mark,
      ...(recovery !== undefined && { recovery }),
      epoch: epoch++,
    });
  let view =
    recovery !== undefined
      ? next(null, recovery)
      : next(mark !== undefined ? mark : signedInAs());
  let closed = false;
  // Moves on as the view closes: what was sent before is not the view's.
  let shown = 0;
  let abort = new AbortController();
  // A new owner: a passkey prompt the one before waits on is over.
  const replace = (owner: Owner) => {
    view = owner;
    abort.abort();
    abort = new AbortController();
  };
  // When the view last began, or had an answer passed on.
  let heard = Date.now();
  // Whether the cookies are still `owner`'s; `now` is `signedInAs()`.
  const holds = (owner: Owner, now: string | null) =>
    owner.recovery !== undefined
      ? now === null && recoveryMark() === owner.recovery
      : now !== null && now === owner.mark;
  return {
    /** Whose an operation begun now is. */
    get owner() {
      return view;
    },
    /** The mark of the session this view is for, null for none. */
    get mark() {
      return view.mark;
    },
    /**
     * Aborted once the view has a new owner or closes: for a passkey
     * prompt an operation begun now waits on.
     */
    get signal() {
      return abort.signal;
    },
    restart() {
      replace(fixed ? next(view.mark, view.recovery) : next(signedInAs()));
      heard = Date.now();
    },
    /** The view is gone (its screen left): nothing more is sent for it. */
    close() {
      closed = true;
      shown++;
      abort.abort();
    },
    /** Shown again, as React mounts a component twice in development. */
    open() {
      if (!closed) return;
      closed = false;
      abort = new AbortController();
      heard = Date.now();
    },
    /** Whether the cookies still name this view's owner. */
    current: () => holds(view, signedInAs()),
    /**
     * Whether what was got as `owner` may still be shown, kept or taken out
     * of the page: it is the view's owner, the view is open, and the
     * cookies name it.
     */
    owns: (owner: Owner) =>
      !closed && owner === view && holds(owner, signedInAs()),
    /**
     * Whether what the view shows is older than `DORMANT_MS`: on a return
     * it hides that and starts again. Never for a recovery, which shows
     * nothing of the user's.
     */
    dormant: () =>
      view.recovery === undefined && Date.now() - heard >= DORMANT_MS,
    /** Sends `request` as `owner`, the view's owner now unless given. */
    async send<T>(
      request: () => Promise<T>,
      change?: SessionChange,
      owner: Owner = view,
    ): Promise<Guarded<T>> {
      if (closed || owner !== view) return stale;
      const recovering = owner.recovery !== undefined;
      const before = signedInAs();
      if (!holds(owner, before)) {
        if (before !== null || recovering)
          return { kind: "changed", sent: false };
        // Begun signed in: that session is over for this page now.
        if (owner.mark !== null) forgetSignedIn();
        return signedOutSince;
      }
      const opened = shown;
      // What to make of the outcome once it is in, decided and told in one
      // step: null passes it on as `owner`'s.
      const settle = (
        outcome: { error: unknown } | { value: T },
      ): Guarded<T> | null => {
        if (opened !== shown || owner !== view) return stale;
        const now = signedInAs();
        if (recovering && change === "begin" && "value" in outcome) {
          if (now === null || begunMark(outcome.value) !== now)
            return changedSince;
          replace(next(now));
          heard = Date.now();
          return { kind: "answer", value: outcome.value, owner: view };
        }
        // This owner's session has ended: every screen hears it now, while
        // the cookies are still as checked.
        const ended = () => {
          if (!recovering) forgetSignedIn();
          return null;
        };
        const expired = "error" in outcome && isApiError(outcome.error, 401);
        if (holds(owner, now)) return expired ? ended() : null;
        // Giving the recovery up: its answer clears the recovery's name
        // with the session (AU-6).
        if (
          recovering &&
          change === "end" &&
          "value" in outcome &&
          now === null &&
          recoveryMark() === ""
        )
          return null;
        if (now === null && !recovering) {
          if (expired) return ended();
          if ("value" in outcome && change === "end") return null;
          forgetSignedIn();
          return signedOutSince;
        }
        return changedSince;
      };
      let value: T;
      try {
        value = await request();
      } catch (error) {
        const drop = settle({ error });
        if (drop) return drop;
        throw error;
      }
      const drop = settle({ value });
      if (drop) return drop;
      heard = Date.now();
      return { kind: "answer", value, owner };
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

/** An answer, and the owner it was taken for (`Guarded`). */
export type Owned<T> = { value: T; owner: Owner };

/**
 * `guard.send` for a caller that wants the answer or an error: a request
 * not sent, or answered, without a session fails as a 401 (the guard has
 * told every screen of the end already). One answered as another user's
 * is that change, and one begun as an owner the view has replaced, or
 * after it closed, is dropped unseen. A recovery's 401 is passed on only
 * while the display cookies stay as the step began (none): its step has
 * expired, and no session's cookies are forgotten.
 */
export async function sendGuarded<T>(
  guard: SessionGuard,
  request: () => Promise<T>,
  change?: SessionChange,
  owner: Owner = guard.owner,
): Promise<Owned<T>> {
  const sent = await guard.send(request, change, owner);
  if (sent.kind === "answer") return sent;
  if (sent.kind === "signed-out") throw new ApiError(401, "unauthorized");
  if (sent.kind === "changed") throw new UserChanged(sent.sent);
  throw new Dropped();
}
