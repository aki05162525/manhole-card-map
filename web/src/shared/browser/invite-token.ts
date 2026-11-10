const key = "friend-invite";
export function clearInviteToken() {
  try {
    sessionStorage.removeItem(key);
  } catch {
    /* storage may be unavailable */
  }
}
// Consume at bootstrap, outside React's repeatable render/initializers.
export function takeInviteToken() {
  try {
    const token = sessionStorage.getItem(key);
    sessionStorage.removeItem(key);
    return token;
  } catch {
    return null;
  }
}
export function saveInviteToken(token: string) {
  sessionStorage.setItem(key, token);
}
