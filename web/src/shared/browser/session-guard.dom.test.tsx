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
// user's, and the screen forgets the cookies on such a 401 itself.
it("passes on an ending answer and a 401 that come back signed out", async () => {
  const ended = sessionGuard().send(async () => {
    signOut();
    return "ok";
  }, "end");
  expect(await ended).toEqual({ kind: "answer", value: "ok" });
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
  beforeEach(signOut);
  it("sends and passes on requests while no session shows", async () => {
    const guard = sessionGuard({ recovery: true });
    expect(guard.current()).toBe(true);
    expect(await guard.send(async () => "options")).toEqual({
      kind: "answer",
      value: "options",
    });
  });
  it("sends nothing once a session has appeared", async () => {
    const guard = sessionGuard({ recovery: true });
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
    const guard = sessionGuard({ recovery: true });
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
    const guard = sessionGuard({ recovery: true });
    const sent = guard.send(async () => {
      document.cookie = "signed_in=1; Path=/";
      markAs("cccc");
      return "profile";
    }, "begin");
    expect(await sent).toEqual({ kind: "answer", value: "profile" });
    expect(guard.current()).toBe(true);
    expect(guard.mark).toBe("cccc");
    // Now an ordinary guard of that session.
    markAs("dddd");
    expect(guard.current()).toBe(false);
  });
  it("does not take another request as the session's beginning", async () => {
    const guard = sessionGuard({ recovery: true });
    const sent = guard.send(async () => {
      document.cookie = "signed_in=1; Path=/";
      markAs("bbbb");
      return "options";
    });
    expect(await sent).toEqual({ kind: "changed", sent: true });
  });
});
