import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { accountRead } from "../contract/private-api";
import { usePrivateApi, type Operation, type PrivateApi } from "./account-api";
import {
  forgetRefusedAhead,
  readAhead,
  readPrivate,
  refusedAhead,
  remembered,
} from "./private-reads";
import { DORMANT_MS } from "./session-guard";

const page = {
  profile: {
    displayName: "たろう",
    passkeys: 1,
    recoveryCodesRemaining: 10,
    rpId: "manhole-techo.com",
    userId: "u1",
  },
  passkeys: [{ id: "p1", label: "パスキー 1", createdAt: 0, lastUsedAt: null }],
};
const answered = () => new Promise((resolve) => setTimeout(resolve));
const signInAs = (mark: string) => {
  document.cookie = "signed_in=1; Path=/";
  document.cookie = `session_mark=${mark}; Path=/`;
};
const signOut = () => {
  document.cookie = "signed_in=; Max-Age=0; Path=/";
  document.cookie = "session_mark=; Max-Age=0; Path=/";
};
// Every request answers the account's page, each with a body of its own.
const answerPage = () =>
  vi.mocked(fetch).mockImplementation(async () => Response.json(page));
let marks = 0;
beforeEach(() => {
  Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true);
  // A session of its own for each test: what one read is not another's.
  signInAs(`mark${marks++}`);
  vi.stubGlobal("fetch", vi.fn());
});
afterEach(() => {
  signOut();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

/** A screen of the signed-in user's, for the operations its reads are of. */
async function screen() {
  let session!: PrivateApi;
  function View() {
    session = usePrivateApi();
    return null;
  }
  const root = createRoot(document.createElement("div"));
  await act(async () => root.render(<View />));
  return { session, leave: () => act(async () => root.unmount()) };
}

it("keeps only a read whose body passed its check", async () => {
  for (const body of [
    { profile: { displayName: "たろう" }, passkeys: [] },
    { ...page, passkeys: null },
    null,
  ]) {
    vi.mocked(fetch).mockResolvedValue(Response.json(body));
    readAhead(accountRead);
    await answered();
    expect(remembered(accountRead)).toBeNull();
  }
  vi.mocked(fetch).mockResolvedValue(Response.json(page));
  readAhead(accountRead);
  await answered();
  expect(remembered(accountRead)).toEqual(page);
});

// PF-5: a read is its session's. A logout leaves nothing for whoever signs
// in next, were the cookies to name the same session again.
it("forgets what was read once the cookies name no session, or another", async () => {
  answerPage();
  const mark = `mark${marks - 1}`;
  readAhead(accountRead);
  await answered();
  expect(remembered(accountRead)).toEqual(page);
  signOut();
  expect(remembered(accountRead)).toBeNull();
  signInAs(mark);
  expect(remembered(accountRead)).toBeNull();

  readAhead(accountRead);
  await answered();
  expect(remembered(accountRead)).toEqual(page);
  signInAs("another");
  expect(remembered(accountRead)).toBeNull();
  signInAs(mark);
  expect(remembered(accountRead)).toBeNull();
});

it("draws a read for an hour, then asks again", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  answerPage();
  readAhead(accountRead);
  await answered();
  vi.setSystemTime(Date.now() + DORMANT_MS - 1);
  expect(remembered(accountRead)).toEqual(page);
  readAhead(accountRead);
  expect(fetch).toHaveBeenCalledTimes(1);
  vi.setSystemTime(Date.now() + 1);
  expect(remembered(accountRead)).toBeNull();
  readAhead(accountRead);
  expect(fetch).toHaveBeenCalledTimes(2);
});

it("hands a read ahead to the screen that opens next, once", async () => {
  answerPage();
  const { session, leave } = await screen();
  readAhead(accountRead);
  await answered();
  const entering = { fresh: false };
  expect(await readPrivate(session.operation(), accountRead, entering)).toEqual(
    page,
  );
  expect(fetch).toHaveBeenCalledTimes(1);
  // Shown now: the screen entered again asks for itself.
  await readPrivate(session.operation(), accountRead, entering);
  expect(fetch).toHaveBeenCalledTimes(2);
  // After a write, never what was read before it.
  await readPrivate(session.operation(), accountRead, { fresh: true });
  expect(fetch).toHaveBeenCalledTimes(3);
  await leave();
});

it("joins a read ahead still on its way, and has shown it by then", async () => {
  answerPage();
  const { session, leave } = await screen();
  readAhead(accountRead);
  const entering = { fresh: false };
  expect(await readPrivate(session.operation(), accountRead, entering)).toEqual(
    page,
  );
  expect(fetch).toHaveBeenCalledTimes(1);
  await readPrivate(session.operation(), accountRead, entering);
  expect(fetch).toHaveBeenCalledTimes(2);
  await leave();
});

// Another tab signed someone else in while the read was on its way: what
// comes in is not kept for the session that asked.
it("keeps nothing that came in once the cookies named another session", async () => {
  const mark = `mark${marks - 1}`;
  let answer!: () => void;
  vi.mocked(fetch).mockImplementation(
    () =>
      new Promise((resolve) => {
        answer = () => resolve(Response.json(page));
      }),
  );
  readAhead(accountRead);
  signInAs("another");
  answer();
  await answered();
  signInAs(mark);
  expect(remembered(accountRead)).toBeNull();
});

// The read checks whose its answer is by itself, as the guard it is sent
// through does: seen here through an operation that passes everything on.
it.each<[string, () => void, object]>([
  ["another session", () => signInAs("another"), { sent: true }],
  ["no session", signOut, { status: 401, code: "unauthorized" }],
])(
  "fails a read answered once the cookies name %s, as its guard would",
  async (_, change, failure) => {
    let answer!: () => void;
    vi.mocked(fetch).mockImplementation(
      () =>
        new Promise((resolve) => {
          answer = () => resolve(Response.json(page));
        }),
    );
    const passing = {
      send: <T,>(request: () => Promise<T>) => request(),
    } as Operation;
    const read = readPrivate(passing, accountRead, { fresh: false });
    await answered();
    change();
    answer();
    await expect(read).rejects.toMatchObject(failure);
  },
);

// AU-9: the settings opened after a read ahead was refused as a recovery's
// session say why, until they have opened or a user signs in.
it("tells of a read ahead refused as a recovery's session until the settings open", async () => {
  signOut();
  expect(refusedAhead()).toBe(false);
  signInAs("refused");
  const refuse = () =>
    vi
      .mocked(fetch)
      .mockImplementation(async () =>
        Response.json({ error: "recovery_session" }, { status: 403 }),
      );
  refuse();
  readAhead(accountRead);
  await answered();
  // The guard took the refusal as the session's end.
  expect(document.cookie).not.toContain("signed_in=1");
  expect(refusedAhead()).toBe(true);
  // Returned to, still signed out: not told yet.
  window.dispatchEvent(new Event("focus"));
  expect(refusedAhead()).toBe(true);
  forgetRefusedAhead();
  expect(refusedAhead()).toBe(false);

  signInAs("refused-again");
  readAhead(accountRead);
  await answered();
  expect(refusedAhead()).toBe(true);
  // A user signed in since: what they open is theirs.
  signInAs("someone");
  window.dispatchEvent(new Event("focus"));
  signOut();
  expect(refusedAhead()).toBe(false);
});
