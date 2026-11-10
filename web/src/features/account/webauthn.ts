import { base64url, fromBase64url } from "../../shared/universal/base64url";
import { api, isApiError } from "./account-api";

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

type Descriptor = { id: string; type: "public-key"; transports?: string[] };
const descriptors = (list: Descriptor[]) =>
  list.map((item) => ({
    ...item,
    id: fromBase64url(item.id),
  })) as PublicKeyCredentialDescriptor[];

// Safari before 18.4 has passkeys but not the JSON helpers.
function creationOptions(json: PublicKeyCredentialCreationOptionsJSON) {
  if (PublicKeyCredential.parseCreationOptionsFromJSON)
    return PublicKeyCredential.parseCreationOptionsFromJSON(json);
  const { excludeCredentials, ...rest } = json;
  return {
    ...(rest as Omit<
      PublicKeyCredentialCreationOptions,
      "challenge" | "user" | "excludeCredentials" | "extensions"
    >),
    challenge: fromBase64url(json.challenge),
    user: { ...json.user, id: fromBase64url(json.user.id) },
    ...(excludeCredentials && {
      excludeCredentials: descriptors(excludeCredentials as Descriptor[]),
    }),
  };
}
function requestOptions(json: PublicKeyCredentialRequestOptionsJSON) {
  if (PublicKeyCredential.parseRequestOptionsFromJSON)
    return PublicKeyCredential.parseRequestOptionsFromJSON(json);
  const { allowCredentials, ...rest } = json;
  return {
    ...(rest as Omit<
      PublicKeyCredentialRequestOptions,
      "challenge" | "allowCredentials" | "extensions"
    >),
    challenge: fromBase64url(json.challenge),
    ...(allowCredentials && {
      allowCredentials: descriptors(allowCredentials as Descriptor[]),
    }),
  };
}

function encode(credential: PublicKeyCredential) {
  if (typeof credential.toJSON === "function") {
    const json = credential.toJSON() as { response?: { userHandle?: unknown } };
    // The Worker compares a present userHandle with the owner.
    if (json.response?.userHandle === null) delete json.response.userHandle;
    return json;
  }
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

export async function createPasskey(
  options: PublicKeyCredentialCreationOptionsJSON,
) {
  const credential = await navigator.credentials.create({
    publicKey: creationOptions(options),
  });
  if (!credential) throw new DOMException("", "NotAllowedError");
  return encode(credential as PublicKeyCredential);
}

export async function getPasskey(
  options: PublicKeyCredentialRequestOptionsJSON,
) {
  const credential = await navigator.credentials.get({
    publicKey: requestOptions(options),
  });
  if (!credential) throw new DOMException("", "NotAllowedError");
  return encode(credential as PublicKeyCredential);
}

// Retries `action` once after a passkey check when the Worker asks for a
// recent verification (AU-11).
export async function withReauth<T>(action: () => Promise<T>) {
  try {
    return await action();
  } catch (error) {
    if (!isApiError(error, 403, "reauth_required")) throw error;
  }
  const options = await api<PublicKeyCredentialRequestOptionsJSON>(
    "/api/auth/reauth/options",
    { method: "POST" },
  );
  await api("/api/auth/reauth/verify", {
    body: { response: await getPasskey(options) },
  });
  return action();
}

// Adds a passkey to the signed-in or recovering account.
export async function addPasskey() {
  const options = await api<PublicKeyCredentialCreationOptionsJSON>(
    "/api/passkeys/register/options",
    { method: "POST" },
  );
  return api<Profile>("/api/passkeys/register/verify", {
    body: { response: await createPasskey(options) },
  });
}

// Replaces all ten recovery codes and returns the new ones (AU-11).
export async function reissueRecoveryCodes() {
  const { recoveryCodes } = await withReauth(() =>
    api<{ recoveryCodes: string[] }>("/api/recovery-codes", { method: "POST" }),
  );
  return recoveryCodes;
}

// Ends the session, a recovery session included.
export const logout = () => api("/api/auth/logout", { method: "POST" });

export type Profile = {
  displayName: string;
  passkeys: number;
  recoveryCodesRemaining: number;
};
