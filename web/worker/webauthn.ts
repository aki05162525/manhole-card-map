import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type RegistrationResponseJSON,
} from "@simplewebauthn/server";
import type { Context } from "./app";
import { base64url, fromBase64url } from "./encoding";
import { HttpError } from "./http";

const MINUTE = 60 * 1000;
const CHALLENGE_TTL = 5 * MINUTE;
// Ed25519, ES256 and RS256 (AU-2).
const algorithms = [-8, -7, -257];
const challengePattern = /^[A-Za-z0-9_-]{43}$/;

// Kept apart so a challenge issued for one ceremony never passes another
// (AU-3).
type Purpose = "register" | "passkey" | "login" | "reauth";

export type StoredCredential = {
  id: string;
  user_id: string;
  public_key: ArrayBuffer | Uint8Array | number[];
  sign_count: number;
  transports: string;
};

const invalid = () => new HttpError(400, "invalid_credential");

// The date shown by passkey managers, in Japan time; never the display name.
const accountLabel = (createdAt: number) =>
  "マンホール手帳 " +
  new Date(createdAt + 9 * 60 * MINUTE).toISOString().slice(0, 10);

async function issueChallenge(
  context: Context,
  purpose: Purpose,
  subject: string | null,
) {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const { DB } = context.env;
  await DB.batch([
    DB.prepare("DELETE FROM challenges WHERE expires_at <= ?").bind(
      context.now,
    ),
    DB.prepare(
      "INSERT INTO challenges (challenge, purpose, subject, expires_at) VALUES (?, ?, ?, ?)",
    ).bind(base64url(bytes), purpose, subject, context.now + CHALLENGE_TTL),
  ]);
  return bytes;
}

// Deletes the challenge named by the client data before any other check, so
// a response is verified at most once, whatever the outcome.
async function consumeChallenge(
  context: Context,
  clientDataJSON: unknown,
  purpose: Purpose,
) {
  let challenge: unknown;
  try {
    challenge = JSON.parse(
      new TextDecoder().decode(fromBase64url(String(clientDataJSON))),
    ).challenge;
  } catch {
    throw invalid();
  }
  if (typeof challenge !== "string" || !challengePattern.test(challenge))
    throw invalid();
  const row = await context.env.DB.prepare(
    "DELETE FROM challenges WHERE challenge = ? AND purpose = ? RETURNING subject, expires_at",
  )
    .bind(challenge, purpose)
    .first<{ subject: string | null; expires_at: number }>();
  if (!row || context.now >= row.expires_at)
    throw new HttpError(400, "invalid_challenge");
  return { challenge, subject: row.subject };
}

function readResponse<T>(value: unknown) {
  const response = value as {
    id?: unknown;
    response?: Record<string, unknown>;
  };
  if (
    typeof response !== "object" ||
    response === null ||
    typeof response.id !== "string" ||
    typeof response.response !== "object" ||
    response.response === null
  )
    throw invalid();
  return response as T & { id: string };
}

export async function registrationOptions(
  context: Context,
  purpose: "register" | "passkey",
  user: { id: string; createdAt: number; credentials?: StoredCredential[] },
) {
  const challenge = await issueChallenge(context, purpose, user.id);
  const name = accountLabel(user.createdAt);
  return generateRegistrationOptions({
    rpName: "マンホール手帳",
    rpID: context.env.RP_ID,
    userName: name,
    userDisplayName: name,
    userID: fromBase64url(user.id),
    challenge,
    timeout: CHALLENGE_TTL,
    attestationType: "none",
    excludeCredentials: (user.credentials ?? []).map(descriptor),
    authenticatorSelection: {
      residentKey: "required",
      userVerification: "required",
    },
    supportedAlgorithmIDs: algorithms,
  });
}

// Returns the user the challenge was issued for and the new credential.
export async function verifyRegistration(
  context: Context,
  value: unknown,
  purpose: "register" | "passkey",
) {
  const response = readResponse<RegistrationResponseJSON>(value);
  const { challenge, subject } = await consumeChallenge(
    context,
    response.response.clientDataJSON,
    purpose,
  );
  try {
    const result = await verifyRegistrationResponse({
      response,
      expectedChallenge: challenge,
      expectedOrigin: context.env.ALLOWED_ORIGIN,
      expectedRPID: context.env.RP_ID,
      expectedType: "webauthn.create",
      requireUserPresence: true,
      requireUserVerification: true,
      supportedAlgorithmIDs: algorithms,
    });
    if (!result.verified) throw invalid();
    return { userId: subject!, credential: result.registrationInfo.credential };
  } catch {
    throw invalid();
  }
}

export async function authenticationOptions(
  context: Context,
  purpose: "login" | "reauth",
  user?: { id: string; credentials: StoredCredential[] },
) {
  const challenge = await issueChallenge(context, purpose, user?.id ?? null);
  return generateAuthenticationOptions({
    rpID: context.env.RP_ID,
    challenge,
    timeout: CHALLENGE_TTL,
    userVerification: "required",
    ...(user && { allowCredentials: user.credentials.map(descriptor) }),
  });
}

// Returns the owner of the verified credential. For reauth the challenge is
// bound to the signed-in user, who must own the credential (AU-1).
export async function verifyAuthentication(
  context: Context,
  value: unknown,
  purpose: "login" | "reauth",
) {
  const response = readResponse<AuthenticationResponseJSON>(value);
  const { challenge, subject } = await consumeChallenge(
    context,
    response.response.clientDataJSON,
    purpose,
  );
  const { DB } = context.env;
  const stored = await DB.prepare(
    "SELECT id, user_id, public_key, sign_count, transports FROM credentials WHERE id = ?",
  )
    .bind(response.id)
    .first<StoredCredential>();
  if (!stored || (subject !== null && stored.user_id !== subject))
    throw invalid();
  const userHandle = response.response.userHandle;
  if (userHandle !== undefined && userHandle !== stored.user_id)
    throw invalid();
  let newCounter: number;
  try {
    const result = await verifyAuthenticationResponse({
      response,
      expectedChallenge: challenge,
      expectedOrigin: context.env.ALLOWED_ORIGIN,
      expectedRPID: context.env.RP_ID,
      expectedType: "webauthn.get",
      requireUserVerification: true,
      // The library rejects a counter that does not grow; synced passkeys
      // stay at 0 and a decrease is only logged (AU-4).
      credential: {
        id: stored.id,
        publicKey: toBytes(stored.public_key),
        counter: 0,
      },
    });
    if (!result.verified) throw invalid();
    newCounter = result.authenticationInfo.newCounter;
  } catch {
    throw invalid();
  }
  if (
    (newCounter > 0 || stored.sign_count > 0) &&
    newCounter <= stored.sign_count
  )
    context.events.push("sign_count_not_increased");
  await DB.prepare(
    "UPDATE credentials SET sign_count = max(sign_count, ?), last_used_at = ? WHERE id = ?",
  )
    .bind(newCounter, context.now, stored.id)
    .run();
  return stored.user_id;
}

// D1 hands BLOBs back as an ArrayBuffer or, through some clients, an array.
const toBytes = (value: StoredCredential["public_key"]) =>
  new Uint8Array(value as ArrayLike<number> | ArrayBuffer);

function descriptor(credential: StoredCredential) {
  const transports: unknown = JSON.parse(credential.transports);
  return {
    id: credential.id,
    ...(Array.isArray(transports) && { transports: transports.map(String) }),
  };
}

export const newUserId = () =>
  base64url(crypto.getRandomValues(new Uint8Array(16)));
