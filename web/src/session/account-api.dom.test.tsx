import { act, startTransition, StrictMode, Suspense, use } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isString, shape } from "../contract/shape";
import {
  beginSession,
  usePrivateApi,
  useOnUser,
  UserChanged,
  type PrivateApi,
} from "./account-api";
import type { GuardFor } from "./session-guard";

const markAs = (value: string) => {
  document.cookie = `session_mark=${value}; Path=/`;
};
beforeEach(() => {
  Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true);
  document.cookie = "signed_in=1; Path=/";
  markAs("aaaa");
});
afterEach(() => {
  document.cookie = "signed_in=; Max-Age=0; Path=/";
  document.cookie = "session_mark=; Max-Age=0; Path=/";
});

// A render held by a transition is not the screen the user sees: another
// user signing in meanwhile is handled by the one on screen, and once the
// held render commits, by that one alone.
it("tells only the committed screen of another user, while a render is held", async () => {
  const heard: string[] = [];
  let release!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve));
  function View({ label }: { label: string }) {
    const session = usePrivateApi();
    useOnUser(session, () => heard.push(label));
    return <p>{label}</p>;
  }
  function Hold({ until }: { until: Promise<void> | null }) {
    if (until) use(until);
    return null;
  }
  const screen = (label: string, until: Promise<void> | null) => (
    <Suspense fallback={<p>…</p>}>
      <View label={label} />
      <Hold until={until} />
    </Suspense>
  );
  const element = document.createElement("div");
  const root = createRoot(element);
  await act(async () => root.render(screen("A", null)));
  // Another tab signs another user in, and this page is returned to.
  const signInAs = async (mark: string) => {
    markAs(mark);
    await act(async () => window.dispatchEvent(new Event("focus")));
  };

  await act(async () => startTransition(() => root.render(screen("B", held))));
  expect(element.textContent).toBe("A");
  await signInAs("bbbb");
  expect(heard).toEqual(["A"]);

  await act(async () => release());
  expect(element.textContent).toBe("B");
  await signInAs("cccc");
  expect(heard).toEqual(["A", "B"]);
  await act(async () => root.unmount());
});

/** A screen of one view of the private API, and what its `onUser` heard. */
async function view(only?: GuardFor, strict = false) {
  let session!: PrivateApi;
  let heard = 0;
  function View() {
    session = usePrivateApi(only);
    useOnUser(session, () => heard++);
    return null;
  }
  const root = createRoot(document.createElement("div"));
  await act(async () =>
    root.render(
      strict ? (
        <StrictMode>
          <View />
        </StrictMode>
      ) : (
        <View />
      ),
    ),
  );
  return {
    session,
    heard: () => heard,
    leave: () => act(async () => root.unmount()),
  };
}
const signOut = () => {
  document.cookie = "signed_in=; Max-Age=0; Path=/";
  document.cookie = "session_mark=; Max-Age=0; Path=/";
};

// A screen for one session or one recovery ends as it begins once the
// cookies name another; any other screen is whoever's is signed in, or
// nobody's, and has nothing to end.
it.each<[string, GuardFor | undefined, () => void, number]>([
  ["a screen of another session", { mark: "bbbb" }, () => {}, 1],
  ["a recovery's step while a session shows", { recovery: "ra" }, () => {}, 1],
  ["a screen of this session", { mark: "aaaa" }, () => {}, 0],
  ["a screen begun signed out", undefined, signOut, 0],
])("ends %s as it begins", async (_, only, before, ended) => {
  before();
  const { heard, leave } = await view(only);
  expect(heard()).toBe(ended);
  await leave();
});

// React mounts a component twice in development: the screen shown the
// second time sends as the first would.
it("sends for a screen mounted twice", async () => {
  const { session, leave } = await view(undefined, true);
  expect(await session.operation().send(async () => "A の記録")).toBe(
    "A の記録",
  );
  await leave();
});

// What was read as an owner is taken out of the page only while the screen
// is that owner's: a change of user found here starts the screen again,
// and what an owner before held starts nothing.
it("starts again when what it holds is found to be another user's, once", async () => {
  const { session, heard, leave } = await view();
  const first = session.owner;
  expect(session.holds(first)).toBe(true);
  markAs("bbbb");
  expect(session.holds(first)).toBe(false);
  expect(heard()).toBe(1);
  expect(session.owner.mark).toBe("bbbb");
  expect(session.holds(first)).toBe(false);
  markAs("cccc");
  expect(session.holds(first)).toBe(false);
  expect(heard()).toBe(1);
  // Left: nothing is held, and nothing starts.
  markAs("bbbb");
  const last = session.owner;
  await leave();
  expect(session.holds(last)).toBe(false);
  expect(heard()).toBe(1);
});

// Two requests answered together once another user has signed in: the
// first starts the screen again, and the second, its owner replaced by
// then, starts nothing more (the screen reads its data anew once).
it("starts again once for requests answered together as another user's", async () => {
  const { session, heard, leave } = await view();
  let answer!: () => void;
  const held = new Promise<void>((resolve) => (answer = resolve));
  const request = async () => {
    await held;
    return "A の記録";
  };
  const sent = [session.operation(), session.operation()].map((operation) =>
    operation.send(request).catch((error: unknown) => error),
  );
  markAs("bbbb");
  answer();
  for (const error of await Promise.all(sent))
    expect(error).toBeInstanceOf(UserChanged);
  expect(heard()).toBe(1);
  await leave();
});

describe("a registration", () => {
  const isBegun = shape<{ sessionMark: string }>({ sessionMark: isString });
  const register = () =>
    beginSession("/api/auth/register/verify", { name: "たろう" }, isBegun);
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ sessionMark: "aaaa" })),
    );
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });
  it("posts its JSON body and answers as the session the cookies name", async () => {
    expect(await register()).toEqual({
      value: { sessionMark: "aaaa" },
      mark: "aaaa",
    });
    expect(vi.mocked(fetch).mock.lastCall).toEqual([
      "/api/auth/register/verify",
      {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: '{"name":"たろう"}',
      },
    ]);
  });
  // Another tab's sign-in or logout replaced the cookies as it came in:
  // what it holds is not for whoever is signed in now.
  it.each<[string, () => void]>([
    ["another session", () => markAs("bbbb")],
    [
      "no session",
      () => {
        document.cookie = "signed_in=; Max-Age=0; Path=/";
      },
    ],
  ])("is not taken once the cookies name %s", async (_, change) => {
    change();
    const error = await register().catch((cause: unknown) => cause);
    expect(error).toBeInstanceOf(UserChanged);
    expect(error).toMatchObject({ sent: true });
  });
});
