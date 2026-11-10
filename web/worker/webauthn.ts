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

// Kept apart so a challenge issued for one ceremony never passes another
// (AU-3).
const purposes = { register: 1, passkey: 2, login: 3, reauth: 4 } as const;
type Purpose = keyof typeof purposes;

// A challenge is version | purpose | expiry (8 bytes, ms) | nonce (32) |
// subject (16, the user ID; zero for a login) | HMAC-SHA-256 of the rest.
// Options write nothing to D1; only a nonce spent by a verified response is
// stored, so the challenge still works once (AU-3).
const VERSION = 1;
const SIGNED = 58;
const SIZE = SIGNED + 32;
const challengePattern = /^[A-Za-z0-9_-]{120}$/;

export type StoredCredential = {
  id: string;
  user_id: string;
  public_key: ArrayBuffer | Uint8Array | number[];
  sign_count: number;
  transports: string;
};

const invalid = () => new HttpError(400, "invalid_credential");
const invalidChallenge = () => new HttpError(400, "invalid_challenge");

// The date shown by passkey managers, in Japan time; never the display name.
const accountLabel = (createdAt: number) =>
  "マンホール手帳 " +
  new Date(createdAt + 9 * 60 * MINUTE).toISOString().slice(0, 10);

const keys = new Map<string, Promise<CryptoKey>>();
function signingKey(context: Context) {
  const secret = context.env.CHALLENGE_SECRET;
  // A short or missing secret stops every ceremony rather than signing
  // with a guessable key.
  if (!secret || secret.length < 32)
    throw new HttpError(503, "auth_unavailable");
  let key = keys.get(secret);
  if (!key) {
    key = crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign", "verify"],
    );
    keys.set(secret, key);
  }
  return key;
}

async function issueChallenge(
  context: Context,
  purpose: Purpose,
  subject: string | null,
) {
  const key = await signingKey(context);
  const bytes = new Uint8Array(SIZE);
  bytes[0] = VERSION;
  bytes[1] = purposes[purpose];
  new DataView(bytes.buffer).setBigUint64(
    2,
    BigInt(context.now + CHALLENGE_TTL),
  );
  bytes.set(crypto.getRandomValues(new Uint8Array(32)), 10);
  if (subject !== null) {
    const id = fromBase64url(subject);
    if (id.length !== 16) throw new Error("user IDs are 16 bytes");
    bytes.set(id, 42);
  }
  const mac = await crypto.subtle.sign("HMAC", key, bytes.subarray(0, SIGNED));
  bytes.set(new Uint8Array(mac), SIGNED);
  return bytes;
}

// Checks the signature, purpose and expiry of the challenge named by the
// client data, without touching D1.
async function openChallenge(
  context: Context,
  clientDataJSON: unknown,
  purpose: Purpose,
) {
  const key = await signingKey(context);
  let challenge: unknown;
  try {
    challenge = JSON.parse(
      new TextDecoder().decode(fromBase64url(String(clientDataJSON))),
    ).challenge;
  } catch {
    throw invalid();
  }
  if (typeof challenge !== "string" || !challengePattern.test(challenge))
    throw invalidChallenge();
  const bytes = fromBase64url(challenge);
  const signed = await crypto.subtle.verify(
    "HMAC",
    key,
    bytes.subarray(SIGNED),
    bytes.subarray(0, SIGNED),
  );
  const expiresAt = Number(new DataView(bytes.buffer).getBigUint64(2));
  if (
    !signed ||
    bytes[0] !== VERSION ||
    bytes[1] !== purposes[purpose] ||
    context.now >= expiresAt
  )
    throw invalidChallenge();
  return {
    challenge,
    nonce: base64url(bytes.subarray(10, 42)),
    expiresAt,
    subject: purpose === "login" ? null : base64url(bytes.subarray(42, SIGNED)),
  };
}

// Called only after the response verified, so a forged or failed attempt
// writes nothing; of two copies of one response, only one gets past here.
async function spendChallenge(
  context: Context,
  { nonce, expiresAt }: { nonce: string; expiresAt: number },
) {
  const { DB } = context.env;
  const [, spent] = (await DB.batch([
    DB.prepare("DELETE FROM used_challenges WHERE expires_at <= ?").bind(
      context.now,
    ),
    DB.prepare(
      "INSERT INTO used_challenges (nonce, expires_at) VALUES (?, ?) ON CONFLICT DO NOTHING RETURNING nonce",
    ).bind(nonce, expiresAt),
  ])) as [unknown, { results: unknown[] }];
  if (!spent.results.length) throw invalidChallenge();
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

// Returns the user the challenge was issued for and the new credential,
// without spending the challenge yet.
export async function verifyRegistration(
  context: Context,
  value: unknown,
  purpose: "register" | "passkey",
) {
  const response = readResponse<RegistrationResponseJSON>(value);
  const opened = await openChallenge(
    context,
    response.response.clientDataJSON,
    purpose,
  );
  let credential;
  try {
    const result = await verifyRegistrationResponse({
      response,
      expectedChallenge: opened.challenge,
      expectedOrigin: context.env.ALLOWED_ORIGIN,
      expectedRPID: context.env.RP_ID,
      expectedType: "webauthn.create",
      requireUserPresence: true,
      requireUserVerification: true,
      supportedAlgorithmIDs: algorithms,
    });
    if (!result.verified) throw invalid();
    credential = result.registrationInfo.credential;
  } catch {
    throw invalid();
  }
  return {
    userId: opened.subject!,
    credential,
    // Spent by the caller once its own checks pass.
    spend: () => spendChallenge(context, opened),
  };
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
  const opened = await openChallenge(
    context,
    response.response.clientDataJSON,
    purpose,
  );
  const { subject } = opened;
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
      expectedChallenge: opened.challenge,
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
  await spendChallenge(context, opened);
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
