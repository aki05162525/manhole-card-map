import { afterEach, beforeEach, expect, it } from "vitest";
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

// Logging out or deleting the account answers with the display cookies
// cleared: that answer is still this user's.
it("passes on an answer that ended the session itself", async () => {
  const guard = sessionGuard();
  const sent = guard.send(async () => {
    document.cookie = "signed_in=; Max-Age=0; Path=/";
    document.cookie = "session_mark=; Max-Age=0; Path=/";
    return "ok";
  });
  expect(await sent).toEqual({ kind: "answer", value: "ok" });
});
