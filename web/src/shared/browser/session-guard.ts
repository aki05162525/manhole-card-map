import { sessionMark, signedIn } from "./signed-in";

/** What became of a private request sent through a guard. */
export type Guarded<T> =
  | { kind: "answer"; value: T }
  /** Not sent: no session now. */
  | { kind: "signed-out" }
  /** Not sent: another user has signed in since the view began. */
  | { kind: "changed" }
  /** Sent before the view started again; its answer or failure is not this view's. */
  | { kind: "stale" };

/**
 * The one check between a view of one user's private data (the records,
 * a friend's map) and the private API. The view belongs to the user whose
 * session mark it began with; `restart()` makes it whoever is signed in now
 * and moves the epoch on. `send` asks only while the cookies still name
 * that user, and drops whatever comes back after a restart, failures and
 * 401 included. The mark only decides what to show; the HttpOnly session
 * authorizes the request.
 */
export function sessionGuard() {
  let view = { mark: sessionMark(), epoch: 0 };
  return {
    get epoch() {
      return view.epoch;
    },
    restart() {
      view = { mark: sessionMark(), epoch: view.epoch + 1 };
    },
    /** Whether the cookies still name this view's user. */
    current: () => signedIn() && sessionMark() === view.mark,
    async send<T>(request: () => Promise<T>): Promise<Guarded<T>> {
      if (!signedIn()) return { kind: "signed-out" };
      if (sessionMark() !== view.mark) return { kind: "changed" };
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
