import { base64url, fromBase64url } from "../../contract/base64url";
import {
  ApiError,
  isApiError,
  type Operation,
} from "../../session/account-api";
import { signalUnknownPasskey } from "./passkey-signals";
import {
  isCreationOptions,
  isProfile,
  isRecoveryCodes,
  isRequestOptions,
} from "../../contract/private-api";

// In-app browsers often expose the API but cannot finish a ceremony (AU-13).
const inAppBrowser = /\bLine\/|FBAN|FBAV|Instagram|MicroMessenger/;

export const passkeysSupported = () =>
  typeof PublicKeyCredential !== "undefined" &&
  !!navigator.credentials &&
  !inAppBrowser.test(navigator.userAgent);

// The prompt was dismissed or timed out: go back without an error.
export const cancelled = (error: unknown) =>
  error instanceof DOMException &&
  (error.name === "NotAllowedError" || error.name === "AbortError");

const toBase64url = (buffer: ArrayBuffer) => base64url(new Uint8Array(buffer));

const descriptors = (list: PublicKeyCredentialDescriptorJSON[]) =>
  list.map((item) => ({ ...item, id: fromBase64url(item.id) }));

// Safari before 18.4 has passkeys but not the JSON helpers. The fallback
// decodes the buffers and passes the other members as the Worker wrote
// them. lib.dom names some of those strings (attestation, a descriptor's
// type and transports, user verification) with its enums, where WebAuthn
// takes any string and ignores one it does not know. The extensions are
// passed as written too: the Worker asks only for credProps, a boolean in
// either form, and lib.dom types the JSON form's buffers as strings.
function creationOptions(
  json: PublicKeyCredentialCreationOptionsJSON,
): PublicKeyCredentialCreationOptions {
  if (PublicKeyCredential.parseCreationOptionsFromJSON)
    return PublicKeyCredential.parseCreationOptionsFromJSON(json);
  const { excludeCredentials, ...rest } = json;
  const options = {
    ...rest,
    challenge: fromBase64url(json.challenge),
    user: { ...json.user, id: fromBase64url(json.user.id) },
    ...(excludeCredentials && {
      excludeCredentials: descriptors(excludeCredentials),
    }),
  };
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- lib.dom's enums for strings WebAuthn takes as any string; the extensions stay as written (above).
  return options as Omit<PublicKeyCredentialCreationOptions, "extensions">;
}
function requestOptions(
  json: PublicKeyCredentialRequestOptionsJSON,
): PublicKeyCredentialRequestOptions {
  if (PublicKeyCredential.parseRequestOptionsFromJSON)
    return PublicKeyCredential.parseRequestOptionsFromJSON(json);
  const { allowCredentials, ...rest } = json;
  const options = {
    ...rest,
    challenge: fromBase64url(json.challenge),
    ...(allowCredentials && {
      allowCredentials: descriptors(allowCredentials),
    }),
  };
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- lib.dom's enums for strings WebAuthn takes as any string; the extensions stay as written (above).
  return options as Omit<PublicKeyCredentialRequestOptions, "extensions">;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
// The browser's own encoding, once it names the credential. The Worker
// checks the rest, and compares a present userHandle with the owner.
function credentialJSON(value: unknown) {
  if (!isRecord(value) || typeof value.id !== "string") return undefined;
  const { id, response } = value;
  if (!isRecord(response) || response.userHandle !== null)
    return { ...value, id };
  const { userHandle: _, ...rest } = response;
  return { ...value, id, response: rest };
}

// A ceremony answers with nothing when the prompt was given up on. The
// browser's PublicKeyCredential, and a passkey manager's own object that
// stands in for one, encode themselves (`toJSON`); only a PublicKeyCredential
// without it is read buffer by buffer.
function encode(answer: Credential | null) {
  if (answer === null) throw new DOMException("", "NotAllowedError");
  const toJSON: unknown = Reflect.get(answer, "toJSON");
  const json =
    typeof toJSON === "function"
      ? credentialJSON(Reflect.apply(toJSON, answer, []))
      : undefined;
  if (json) return json;
  if (!(answer instanceof PublicKeyCredential))
    throw new DOMException("", "NotAllowedError");
  const credential = answer;
  const response = credential.response;
  return {
    id: credential.id,
    rawId: toBase64url(credential.rawId),
    type: credential.type,
    authenticatorAttachment: credential.authenticatorAttachment ?? undefined,
    clientExtensionResults: credential.getClientExtensionResults(),
    response: {
      clientDataJSON: toBase64url(response.clientDataJSON),
      ...(response instanceof AuthenticatorAttestationResponse
        ? {
            attestationObject: toBase64url(response.attestationObject),
            transports: response.getTransports?.() ?? [],
          }
        : response instanceof AuthenticatorAssertionResponse && {
            authenticatorData: toBase64url(response.authenticatorData),
            signature: toBase64url(response.signature),
            ...(response.userHandle && {
              userHandle: toBase64url(response.userHandle),
            }),
          }),
    },
  };
}

// `signal` ends the prompt when the screen that asked for it is left.
export async function createPasskey(
  options: PublicKeyCredentialCreationOptionsJSON,
  signal?: AbortSignal,
) {
  const credential = await navigator.credentials.create({
    publicKey: creationOptions(options),
    ...(signal && { signal }),
  });
  return encode(credential);
}

export async function getPasskey(
  options: PublicKeyCredentialRequestOptionsJSON,
  signal?: AbortSignal,
) {
  const credential = await navigator.credentials.get({
    publicKey: requestOptions(options),
    ...(signal && { signal }),
  });
  return encode(credential);
}

/**
 * Sends the passkey just made to be verified. One the Worker refuses stays
 * in the passkey manager with no account behind it, so the manager is told
 * to drop it. Only on a refusal: a 4xx, or a reauthentication given up on
 * after one. When the answer is lost or the Worker fails, the passkey may
 * be registered, and for a new account it is then the only way in. Nothing
 * is told for a screen that was left (`left`).
 */
export async function verifyCreated<T>(
  options: PublicKeyCredentialCreationOptionsJSON,
  response: { id: string },
  verify: () => Promise<T>,
  left?: AbortSignal,
) {
  try {
    return await verify();
  } catch (error) {
    const refused =
      (error instanceof ApiError && error.status < 500) ||
      error instanceof DOMException;
    if (refused && !left?.aborted)
      signalUnknownPasskey(options.rp.id, response.id);
    throw error;
  }
}

// Retries `action` once after a passkey check when the Worker asks for a
// recent verification (AU-11). The check and the action are one operation:
// every request goes as its owner, so once the screen is left or has a new
// owner (another user signed in while the prompt is open), neither the
// check nor the action is sent again, as anyone.
export async function withReauth<T>(
  operation: Operation,
  action: () => Promise<T>,
) {
  try {
    return await action();
  } catch (error) {
    if (!isApiError(error, 403, "reauth_required")) throw error;
  }
  const options = await operation.api("/api/auth/reauth/options", {
    method: "POST",
    read: isRequestOptions,
  });
  const response = await getPasskey(options, operation.signal);
  await operation.api("/api/auth/reauth/verify", { body: { response } });
  return action();
}

// Adds a passkey to the signed-in or recovering account: the new profile,
// and the owner it was taken for (in a recovery, the session it began).
export async function addPasskey(operation: Operation) {
  const options = await withReauth(operation, () =>
    operation.api("/api/passkeys/register/options", {
      method: "POST",
      read: isCreationOptions,
    }),
  );
  const response = await createPasskey(options, operation.signal);
  // Retry verification with the same credential if the five-minute window
  // elapsed while the registration prompt was open.
  return verifyCreated(
    options,
    response,
    () =>
      withReauth(operation, () =>
        // In a recovery, the answer begins the new session (AU-9).
        operation.owned("/api/passkeys/register/verify", {
          body: { response },
          change: "begin",
          read: isProfile,
        }),
      ),
    operation.signal,
  );
}

// Replaces all ten recovery codes and returns the new ones (AU-11), with
// the owner whose they are: the session the reissue was taken for.
export async function reissueRecoveryCodes(operation: Operation) {
  const { value, owner } = await withReauth(operation, () =>
    operation.owned("/api/recovery-codes", {
      method: "POST",
      read: isRecoveryCodes,
    }),
  );
  return { codes: value.recoveryCodes, owner };
}

// Ends the session, a recovery session included.
export const logout = (operation: Operation) =>
  operation.api("/api/auth/logout", { method: "POST", change: "end" });
