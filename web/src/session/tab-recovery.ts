const key = "account-recovering";

/**
 * The recovery this tab is in, by its `recoveryMark`, or null: kept only to
 * resume its step after a reload, while `recovery_mark` still names it.
 * `null` forgets it. sessionStorage may throw (blocked storage).
 */
export function tabRecovery(value?: string | null) {
  try {
    if (value === null) sessionStorage.removeItem(key);
    else if (value !== undefined) sessionStorage.setItem(key, value);
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}
