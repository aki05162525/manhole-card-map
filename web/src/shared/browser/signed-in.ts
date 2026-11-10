import { clearInviteToken } from "./invite-token";
// `signed_in=1` is the Worker's non-secret display cookie; the session itself
// is HttpOnly.
export const signedIn = () =>
  document.cookie.split(";").some((part) => part.trim() === "signed_in=1");

export const forgetSignedIn = () => {
  clearInviteToken();
  document.cookie = "signed_in=; Max-Age=0; Path=/; SameSite=Lax";
};
