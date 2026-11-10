import { clearInviteToken } from "./invite-token";

// `signed_in=1` is the Worker's non-secret display cookie; the session itself
// is HttpOnly.
export const signedIn = () =>
  document.cookie.split(";").some((part) => part.trim() === "signed_in=1");

export const forgetSignedIn = () => {
  clearInviteToken();
  document.cookie = "signed_in=; Max-Age=0; Path=/; SameSite=Lax";
};

// Another tab may have signed in or out while this page was away. Calls
// `check` whenever the page comes back (focus, bfcache restore, tab shown)
// and returns the function that stops it.
export function onPageReturn(check: (event: Event) => void) {
  window.addEventListener("focus", check);
  window.addEventListener("pageshow", check);
  document.addEventListener("visibilitychange", check);
  return () => {
    window.removeEventListener("focus", check);
    window.removeEventListener("pageshow", check);
    document.removeEventListener("visibilitychange", check);
  };
}
