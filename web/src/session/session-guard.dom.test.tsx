import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ApiError } from "./api";
import { sendGuarded, sessionGuard, UserChanged } from "./session-guard";

const markAs = (value: string) => {
  document.cookie = `session_mark=${value}; Path=/`;
};
beforeEach(() => {
  document.cookie = "signed_in=1; Path=/";
  markAs("aaaa");
});
afterEach(() => {
  document.cookie = "signed_in=; Max-Age=0; Path=/";
  document.cookie = "session_mark=; Max-Age=0; Path=/";
});

// A's request is on its way when another tab signs B in, and it comes back
// before this page notices the return (no `restart()`).
const outcomes: [string, () => Promise<string>][] = [
  ["an answer", async () => "A のデータ"],
  ["a failure", async () => Promise.reject(new ApiError(500, "error"))],
  ["a 401", async () => Promise.reject(new ApiError(401, "unauthorized"))],
];
it.each(outcomes)(
  "drops %s asked for by the user before another signed in",
  async (_, outcome) => {
    const guard = sessionGuard();
    let answer!: () => void;
    const held = new Promise<void>((resolve) => (answer = resolve));
    const sent = sendGuarded(guard, async () => {
      await held;
      return outcome();
    });
    markAs("bbbb");
    answer();
    await expect(sent).rejects.toBeInstanceOf(UserChanged);
    expect(document.cookie).toContain("signed_in=1");
    expect(document.cookie).toContain("session_mark=bbbb");
  },
);

const signOut = () => {
  document.cookie = "signed_in=; Max-Age=0; Path=/";
  document.cookie = "session_mark=; Max-Age=0; Path=/";
};
// Another tab logged out while the request was on its way: an ordinary
// answer is the user's before, and this page is signed out now.
it("drops an ordinary answer that comes back signed out", async () => {
  const guard = sessionGuard();
  const sent = guard.send(async () => {
    signOut();
    return "A の回復コード";
  });
  expect(await sent).toEqual({ kind: "signed-out" });
});
// Another tab's logout cleared the display cookies on the way. A logout or a
// deletion of this view's own (sent as the end) clears them with its answer,
// and a 401 tells that this user's session has ended: these are still the
// user's. The guard tells every screen of either as it takes it, and the
// end closes the view: nothing more is sent for it.
it("passes on an ending answer and a 401 that come back signed out", async () => {
  const guard = sessionGuard();
  const ended = guard.send(async () => {
    signOut();
    return "ok";
  }, "end");
  expect(await ended).toMatchObject({
    kind: "answer",
    value: "ok",
    owner: { mark: "aaaa" },
  });
  expect(await guard.send(async () => "more")).toEqual({ kind: "stale" });
  markAs("aaaa");
  document.cookie = "signed_in=1; Path=/";
  const expired = sessionGuard().send(async () => {
    signOut();
    throw new ApiError(401, "unauthorized");
  });
  await expect(expired).rejects.toMatchObject({ status: 401 });
});
it("drops an ending answer once another user has signed in", async () => {
  const guard = sessionGuard();
  const sent = guard.send(async () => {
    markAs("bbbb");
    return "ok";
  }, "end");
  expect(await sent).toEqual({ kind: "changed", sent: true });
});

// A recovery session has no display cookies (AU-9). Once another tab signs
// a user in, the recovery is over: nothing is sent for it, and nothing that
// comes back, a 401 included, is taken as its own.
describe("a recovery", () => {
  // This view's recovery, as the Worker names it in `recovery_mark`.
  beforeEach(() => {
    signOut();
    document.cookie = "recovery_mark=ra; Path=/";
  });
  afterEach(() => {
    document.cookie = "recovery_mark=; Max-Age=0; Path=/";
  });
  it("sends and passes on requests while no session shows", async () => {
    const guard = sessionGuard({ recovery: "ra" });
    expect(guard.current()).toBe(true);
    expect(await guard.send(async () => "options")).toMatchObject({
      kind: "answer",
      value: "options",
      owner: { mark: null, recovery: "ra" },
    });
  });
  it("sends nothing once a session has appeared", async () => {
    const guard = sessionGuard({ recovery: "ra" });
    document.cookie = "signed_in=1; Path=/";
    markAs("bbbb");
    expect(guard.current()).toBe(false);
    let asked = false;
    const sent = await guard.send(async () => {
      asked = true;
    }, "end");
    expect(sent).toEqual({ kind: "changed", sent: false });
    expect(asked).toBe(false);
  });
  it("drops a 401 that comes back once a session has appeared", async () => {
    const guard = sessionGuard({ recovery: "ra" });
    const sent = sendGuarded(guard, async () => {
      document.cookie = "signed_in=1; Path=/";
      markAs("bbbb");
      throw new ApiError(401, "unauthorized");
    });
    await expect(sent).rejects.toBeInstanceOf(UserChanged);
    expect(document.cookie).toContain("signed_in=1");
    expect(document.cookie).toContain("session_mark=bbbb");
  });
  it("becomes the session its own registration began", async () => {
    const guard = sessionGuard({ recovery: "ra" });
    const sent = guard.send(async () => {
      document.cookie = "signed_in=1; Path=/";
      markAs("cccc");
      return { sessionMark: "cccc" };
    }, "begin");
    // Answered as the session it began, the view's owner from now on.
    const answer = await sent;
    expect(answer).toMatchObject({
      kind: "answer",
      value: { sessionMark: "cccc" },
      owner: { mark: "cccc" },
    });
    expect(answer.kind === "answer" && answer.owner).toBe(guard.owner);
    expect(guard.current()).toBe(true);
    expect(guard.mark).toBe("cccc");
    // Now an ordinary guard of that session.
    markAs("dddd");
    expect(guard.current()).toBe(false);
  });
  // The registration's answer names the session it began; another one in
  // the cookies by then (another tab's sign-in) is not that session.
  it("does not take a registration answered as another session's as its beginning", async () => {
    const guard = sessionGuard({ recovery: "ra" });
    const sent = guard.send(async () => {
      document.cookie = "signed_in=1; Path=/";
      markAs("bbbb");
      return { sessionMark: "cccc" };
    }, "begin");
    expect(await sent).toEqual({ kind: "changed", sent: true });
    expect(guard.current()).toBe(false);
  });
  // A stale recovery screen opened while a user is signed in is not that
  // user's: it sends nothing, and their session does not become its own.
  it("sends nothing when begun while a session shows", async () => {
    document.cookie = "signed_in=1; Path=/";
    markAs("bbbb");
    const guard = sessionGuard({ recovery: "ra" });
    expect(guard.current()).toBe(false);
    let asked = false;
    const sent = await guard.send(async () => {
      asked = true;
    }, "end");
    expect(sent).toEqual({ kind: "changed", sent: false });
    expect(asked).toBe(false);
    guard.restart();
    expect(guard.current()).toBe(false);
  });
  // Another tab's recovery replaced this one's session, and its cookies
  // show no session either: only the recovery's name tells them apart.
  it("sends and takes nothing once another recovery has begun", async () => {
    const guard = sessionGuard({ recovery: "ra" });
    const sent = sendGuarded(guard, async () => {
      document.cookie = "recovery_mark=rb; Path=/";
      throw new ApiError(401, "unauthorized");
    });
    await expect(sent).rejects.toBeInstanceOf(UserChanged);
    expect(guard.current()).toBe(false);
    let asked = false;
    expect(
      await guard.send(async () => {
        asked = true;
      }, "end"),
    ).toEqual({ kind: "changed", sent: false });
    expect(asked).toBe(false);
    guard.restart();
    expect(guard.current()).toBe(false);
  });
  // Its registration's success is the session it began or nothing: with no
  // session in the cookies as it comes in (another tab's logout), it is not
  // taken by the recovery's own test.
  it("does not take a registration as begun while no session shows", async () => {
    const guard = sessionGuard({ recovery: "ra" });
    const sent = guard.send(async () => ({ sessionMark: "cccc" }), "begin");
    expect(await sent).toEqual({ kind: "changed", sent: true });
  });
  // Giving the recovery up (its logout) clears its name with the answer
  // (AU-6): that end is still this recovery's. Any other answer that comes
  // back without the name, or under another's, is not.
  it("passes on its own end, whose answer clears the recovery's name", async () => {
    const forget = () => {
      document.cookie = "recovery_mark=; Max-Age=0; Path=/";
    };
    const ended = sessionGuard({ recovery: "ra" }).send(async () => {
      forget();
      return { ok: true };
    }, "end");
    expect(await ended).toMatchObject({ kind: "answer", value: { ok: true } });
    document.cookie = "recovery_mark=ra; Path=/";
    const other = sessionGuard({ recovery: "ra" }).send(async () => {
      forget();
      return "options";
    });
    expect(await other).toEqual({ kind: "changed", sent: true });
    document.cookie = "recovery_mark=ra; Path=/";
    const replaced = sessionGuard({ recovery: "ra" }).send(async () => {
      document.cookie = "recovery_mark=rb; Path=/";
      return { ok: true };
    }, "end");
    expect(await replaced).toEqual({ kind: "changed", sent: true });
  });
  it("does not take another request as the session's beginning", async () => {
    const guard = sessionGuard({ recovery: "ra" });
    const sent = guard.send(async () => {
      document.cookie = "signed_in=1; Path=/";
      markAs("bbbb");
      return "options";
    });
    expect(await sent).toEqual({ kind: "changed", sent: true });
  });
});

// A view of one session (`mark`) keeps it as it starts again: once the
// cookies name another, nothing is sent for it, before or after a restart.
it("keeps a view of one session to that session", async () => {
  const guard = sessionGuard({ mark: "aaaa" });
  expect(guard.current()).toBe(true);
  markAs("bbbb");
  guard.restart();
  expect(guard.current()).toBe(false);
  expect(guard.mark).toBe("aaaa");
  let asked = false;
  expect(
    await guard.send(async () => {
      asked = true;
    }),
  ).toEqual({ kind: "changed", sent: false });
  expect(asked).toBe(false);
});

// Another tab signs B in a few steps after A's 401 came back: before the
// guard checks it (then it is not A's), or after (then A's display cookies
// are gone already). The check and the forgetting are one step, so B's
// cookies stay whenever B came (PF-5, Issue #360).
it.each(Array.from({ length: 12 }, (_, ticks) => ticks))(
  "keeps the cookies of a user who signed in as a 401 came back (%i ticks)",
  async (ticks) => {
    const guard = sessionGuard();
    const later = (left: number) => {
      if (left > 0) return queueMicrotask(() => later(left - 1));
      document.cookie = "signed_in=1; Path=/";
      markAs("bbbb");
    };
    const sent = sendGuarded(guard, async () => {
      later(ticks);
      throw new ApiError(401, "unauthorized");
    });
    await sent.catch(() => {});
    await new Promise((resolve) => setTimeout(resolve));
    expect(document.cookie).toContain("session_mark=bbbb");
    expect(document.cookie).toContain("signed_in=1");
  },
);

// What an operation begun as A sends is A's to the end: a restart (another
// user seen on a return) makes a new owner for what starts after it, and
// the operation's next step is not sent as B (Issue #360).
it("sends nothing more of an operation begun before a restart", async () => {
  const guard = sessionGuard();
  const owner = guard.owner;
  markAs("bbbb");
  guard.restart();
  expect(guard.owner.mark).toBe("bbbb");
  expect(owner.mark).toBe("aaaa");
  let asked = false;
  const sent = await guard.send(
    async () => {
      asked = true;
    },
    undefined,
    owner,
  );
  expect(sent).toEqual({ kind: "stale" });
  expect(asked).toBe(false);
});
