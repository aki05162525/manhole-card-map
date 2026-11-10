import { afterEach, expect, it } from "vitest";
import { forgetSignedIn, signedIn } from "./signed-in";
afterEach(() => {
  sessionStorage.clear();
  document.cookie = "signed_in=; Max-Age=0; Path=/";
});
it("clears pending invitations along with the display session on logout", () => {
  document.cookie = "signed_in=1; Path=/";
  sessionStorage.setItem("friend-invite", "old-token");
  forgetSignedIn();
  expect(signedIn()).toBe(false);
  expect(sessionStorage.getItem("friend-invite")).toBeNull();
});
