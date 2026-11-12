import { useSyncExternalStore } from "react";
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

/** The session has ended (logout, deletion, a 401): every screen hears it. */
export const forgetSignedIn = () => {
  clearInviteToken();
  document.cookie = "signed_in=; Max-Age=0; Path=/; SameSite=Lax";
  document.cookie = "session_mark=; Max-Age=0; Path=/; SameSite=Lax";
  sessionChanged();
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
let notifying = false;
let again = false;
function notify(type: string) {
  // A check may end the session itself (`forgetSignedIn`); the checks then
  // run once more after this round instead of inside it.
  if (notifying) {
    again = true;
    return;
  }
  notifying = true;
  try {
    do {
      again = false;
      const event = new Event(type);
      for (const check of Array.from(returns)) check(event);
    } while (again);
  } finally {
    notifying = false;
  }
}
/** Before another screen of the document is shown, as on a return. */
export const recheckSession = () => notify("screenswitch");
/**
 * This page has signed in, registered or signed out: the screens kept in the
 * document (the header, the records, a friend's map) check the cookies again,
 * as on a return. The one place a change of session is told.
 */
export const sessionChanged = () => notify("sessionchange");

const never = () => () => {};
const signedOut = () => false;
/**
 * `signedIn()`, rendered again whenever the session may have changed. A
 * build without accounts reads no cookie and listens to nothing.
 */
export const useSignedIn = () =>
  useSyncExternalStore(
    import.meta.env.VITE_ACCOUNTS_ENABLED === "true" ? onPageReturn : never,
    import.meta.env.VITE_ACCOUNTS_ENABLED === "true" ? signedIn : signedOut,
    signedOut,
  );
