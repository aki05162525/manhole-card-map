import { act, startTransition, Suspense, use } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it } from "vitest";
import { usePrivateApi, useOnUser } from "./account-api";

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
