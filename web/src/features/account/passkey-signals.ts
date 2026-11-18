/**
 * Tells the passkey manager what the Worker holds (the WebAuthn Signal
 * API), so a passkey deleted here stops being offered and the account shows
 * under its current name. Only a hint behind what the page does: browsers
 * without it (Firefox) skip it, nothing waits for it, and a failure is a
 * warning in the console.
 */
type SignalApi = Pick<
  typeof PublicKeyCredential,
  | "signalUnknownCredential"
  | "signalAllAcceptedCredentials"
  | "signalCurrentUserDetails"
>;

/** The RP ID and the user.id of the passkeys, as the Worker answers them. */
export type PasskeyAccount = { rpId: string; userId: string };

// The browser throws on anything but unpadded base64url.
const unpadded = /^[A-Za-z0-9_-]+$/;
const base64url = (value: unknown) =>
  typeof value === "string" && value.length % 4 !== 1 && unpadded.test(value);

function signal<Name extends keyof SignalApi>(
  name: Name,
  options: Parameters<SignalApi[Name]>[0],
  ids: unknown[],
) {
  const api: Partial<SignalApi> | undefined =
    typeof PublicKeyCredential === "undefined"
      ? undefined
      : PublicKeyCredential;
  const send = api?.[name] as
    | ((options: Parameters<SignalApi[Name]>[0]) => Promise<void>)
    | undefined;
  if (!send) return;
  if (!options.rpId || !ids.every(base64url)) {
    console.warn(`${name} skipped: the RP ID or an ID is not usable`);
    return;
  }
  void (async () => {
    try {
      await send.call(api, options);
    } catch (error) {
      console.warn(`${name} failed`, error);
    }
  })();
}

/** A passkey the Worker does not have: the manager may stop offering it. */
export const signalUnknownPasskey = (
  rpId: string | undefined,
  credentialId: string,
) =>
  signal("signalUnknownCredential", { rpId: rpId ?? "", credentialId }, [
    credentialId,
  ]);

/**
 * Every passkey of the account, from one answer of the Worker: the manager
 * may drop the others, so never a list read before a passkey was added.
 */
export const signalPasskeys = (
  { rpId, userId }: PasskeyAccount,
  allAcceptedCredentialIds: string[],
) =>
  signal(
    "signalAllAcceptedCredentials",
    { rpId, userId, allAcceptedCredentialIds },
    [userId, ...allAcceptedCredentialIds],
  );

/** The display name, which is the name the passkeys were registered under. */
export const signalDisplayName = (
  { rpId, userId }: PasskeyAccount,
  displayName: string,
) =>
  signal(
    "signalCurrentUserDetails",
    { rpId, userId, name: displayName, displayName },
    [userId],
  );
