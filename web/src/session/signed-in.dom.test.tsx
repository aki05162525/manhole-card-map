import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { takeInviteToken } from "./invite-token";
import {
  forgetSignedIn,
  onPageReturn,
  recheckSession,
  sessionMark,
  signedIn,
  useSignedIn,
} from "./signed-in";
import { tabRecovery } from "./tab-recovery";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  sessionStorage.clear();
  document.cookie = "signed_in=; Max-Age=0; Path=/";
  document.cookie = "session_mark=; Max-Age=0; Path=/";
});
it("clears pending invitations along with the display session on logout", () => {
  document.cookie = "signed_in=1; Path=/";
  document.cookie = "session_mark=aaaa; Path=/";
  sessionStorage.setItem("friend-invite", "old-token");
  forgetSignedIn();
  expect(signedIn()).toBe(false);
  expect(sessionMark()).toBe("");
  expect(sessionStorage.getItem("friend-invite")).toBeNull();
});

// A cookie whose name only begins with the mark's is another cookie: the
// session has no mark (one issued before them).
it("reads the session's mark by its whole name", () => {
  document.cookie = "session_mark_old=zzzz; Path=/";
  expect(sessionMark()).toBe("");
  document.cookie = "session_mark_old=; Max-Age=0; Path=/";
});

// A check that finds the session over tells every screen itself. The
// screens hear of it after the round they are in, each once more, and none
// while another is still checking.
it("runs the checks once more, not inside one another, when a check ends the session", () => {
  document.cookie = "signed_in=1; Path=/";
  let running = 0;
  let nested = false;
  let rounds = 0;
  const check = () => {
    nested ||= running > 0;
    running++;
    rounds++;
    if (signedIn()) forgetSignedIn();
    running--;
  };
  const stop = onPageReturn(check);
  try {
    recheckSession();
    expect(rounds).toBe(2);
    expect(nested).toBe(false);
  } finally {
    stop();
  }
});

// Blocked storage (a browser's privacy setting) throws on every access:
// read as nothing kept, which the screens tell from a value by `null`.
it("reads no invitation and no recovery where storage is blocked", () => {
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new DOMException("blocked", "SecurityError");
  });
  expect(takeInviteToken()).toBeNull();
  expect(tabRecovery()).toBeNull();
});

// A build without accounts has no session to show, whatever cookie is left
// from one that had.
it("follows the session only in a build with accounts", async () => {
  Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true);
  document.cookie = "signed_in=1; Path=/";
  function Shown() {
    return String(useSignedIn());
  }
  const element = document.createElement("div");
  const without = createRoot(element);
  await act(async () => without.render(<Shown />));
  expect(element.textContent).toBe("false");
  await act(async () => without.unmount());

  vi.stubEnv("VITE_ACCOUNTS_ENABLED", "true");
  const root = createRoot(element);
  await act(async () => root.render(<Shown />));
  expect(element.textContent).toBe("true");
  await act(async () => forgetSignedIn());
  expect(element.textContent).toBe("false");
  await act(async () => root.unmount());
});
