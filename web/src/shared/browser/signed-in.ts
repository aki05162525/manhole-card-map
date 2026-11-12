import { clearInviteToken } from "./invite-token";

// `signed_in=1` is the Worker's non-secret display cookie; the session itself
// is HttpOnly.
export const signedIn = () =>
  document.cookie.split(";").some((part) => part.trim() === "signed_in=1");

/**
 * The Worker's other display cookie, different for each session: a page
 * holding one user's records compares it to see that another user has
 * signed in since. A session issued before it has none, read as "". Never
 * used to authorize.
 */
export const sessionMark = () =>
  document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("session_mark="))
    ?.slice("session_mark=".length) ?? "";

export const forgetSignedIn = () => {
  clearInviteToken();
  document.cookie = "signed_in=; Max-Age=0; Path=/; SameSite=Lax";
  document.cookie = "session_mark=; Max-Age=0; Path=/; SameSite=Lax";
};

const returns = new Set<(event: Event) => void>();
// Another tab may have signed in or out while this page was away. Calls
// `check` whenever the page comes back (focus, bfcache restore, tab shown)
// and before it switches screens, and returns the function that stops it.
export function onPageReturn(check: (event: Event) => void) {
  window.addEventListener("focus", check);
  window.addEventListener("pageshow", check);
  document.addEventListener("visibilitychange", check);
  returns.add(check);
  return () => {
    window.removeEventListener("focus", check);
    window.removeEventListener("pageshow", check);
    document.removeEventListener("visibilitychange", check);
    returns.delete(check);
  };
}
/** Before another screen of the document is shown, as on a return. */
export function recheckSession() {
  const event = new Event("screenswitch");
  for (const check of Array.from(returns)) check(event);
}
