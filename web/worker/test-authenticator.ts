import { createHash, webcrypto } from "node:crypto";

// A software authenticator that signs WebAuthn responses the way a platform
// passkey does, with knobs to break each part the server must check.

type Cbor = number | string | Uint8Array | Cbor[] | Map<number | string, Cbor>;

function head(major: number, length: number) {
  if (length < 24) return [(major << 5) | length];
  if (length < 0x100) return [(major << 5) | 24, length];
  if (length < 0x10000) return [(major << 5) | 25, length >> 8, length & 0xff];
  return [
    (major << 5) | 26,
    (length >>> 24) & 0xff,
    (length >> 16) & 0xff,
    (length >> 8) & 0xff,
    length & 0xff,
  ];
}

function cbor(value: Cbor): Uint8Array {
  if (typeof value === "number")
    return new Uint8Array(value < 0 ? head(1, -1 - value) : head(0, value));
  if (typeof value === "string") {
    const bytes = new TextEncoder().encode(value);
    return concat(new Uint8Array(head(3, bytes.length)), bytes);
  }
  if (value instanceof Uint8Array)
    return concat(new Uint8Array(head(2, value.length)), value);
  if (Array.isArray(value))
    return concat(new Uint8Array(head(4, value.length)), ...value.map(cbor));
  return concat(
    new Uint8Array(head(5, value.size)),
    ...[...value].flatMap(([key, item]) => [cbor(key), cbor(item)]),
  );
}

function concat(...parts: Uint8Array[]) {
  const out = new Uint8Array(
    parts.reduce((size, part) => size + part.length, 0),
  );
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

const b64 = (bytes: Uint8Array) => Buffer.from(bytes).toString("base64url");
const unb64 = (text: string) => new Uint8Array(Buffer.from(text, "base64url"));
const sha256 = (bytes: Uint8Array | string) =>
  new Uint8Array(createHash("sha256").update(bytes).digest());

// WebAuthn wants ES256 signatures in DER, WebCrypto returns r || s.
function der(raw: Uint8Array) {
  const integer = (bytes: Uint8Array) => {
    let start = 0;
    while (start < bytes.length - 1 && bytes[start] === 0) start++;
    let body = bytes.slice(start);
    if (body[0]! & 0x80) body = concat(new Uint8Array([0]), body);
    return concat(new Uint8Array([2, body.length]), body);
  };
  const body = concat(integer(raw.slice(0, 32)), integer(raw.slice(32)));
  return concat(new Uint8Array([0x30, body.length]), body);
}

export type Algorithm = -7 | -8 | -257;

const keyParams = {
  [-7]: { name: "ECDSA", namedCurve: "P-256" },
  [-8]: { name: "Ed25519" },
  [-257]: {
    name: "RSASSA-PKCS1-v1_5",
    modulusLength: 2048,
    publicExponent: new Uint8Array([1, 0, 1]),
    hash: "SHA-256",
  },
} as const;
const signParams = {
  [-7]: { name: "ECDSA", hash: "SHA-256" },
  [-8]: { name: "Ed25519" },
  [-257]: { name: "RSASSA-PKCS1-v1_5" },
} as const;

async function coseKey(alg: Algorithm, key: webcrypto.CryptoKey) {
  const jwk = await webcrypto.subtle.exportKey("jwk", key);
  if (alg === -7)
    return cbor(
      new Map<number, Cbor>([
        [1, 2],
        [3, -7],
        [-1, 1],
        [-2, unb64(jwk.x!)],
        [-3, unb64(jwk.y!)],
      ]),
    );
  if (alg === -8)
    return cbor(
      new Map<number, Cbor>([
        [1, 1],
        [3, -8],
        [-1, 6],
        [-2, unb64(jwk.x!)],
      ]),
    );
  return cbor(
    new Map<number, Cbor>([
      [1, 3],
      [3, -257],
      [-1, unb64(jwk.n!)],
      [-2, unb64(jwk.e!)],
    ]),
  );
}

export const UP = 0x01;
export const UV = 0x04;
const AT = 0x40;

type Ceremony = {
  origin: string;
  rpId: string;
  // Overrides that break one check at a time.
  type?: string;
  challenge?: string;
  flags?: number;
  counter?: number;
  userHandle?: string | null;
  tamper?: boolean;
};

type Credential = {
  id: string;
  alg: Algorithm;
  keys: webcrypto.CryptoKeyPair;
  userHandle: string;
  counter: number;
};

// The JSON options from the server, read loosely like a browser does.
type Options = Record<string, any>;

export class Authenticator {
  readonly credentials: Credential[] = [];

  async register(
    options: Options,
    { alg = -7, ...ceremony }: Ceremony & { alg?: Algorithm },
  ) {
    const keys = (await webcrypto.subtle.generateKey(keyParams[alg], true, [
      "sign",
      "verify",
    ])) as webcrypto.CryptoKeyPair;
    const rawId = webcrypto.getRandomValues(new Uint8Array(32));
    const credential: Credential = {
      id: b64(rawId),
      alg,
      keys,
      userHandle: options.user!.id,
      counter: 0,
    };
    this.credentials.push(credential);
    const clientDataJSON = this.clientData(
      "webauthn.create",
      options,
      ceremony,
    );
    const authData = concat(
      sha256(ceremony.rpId),
      new Uint8Array([(ceremony.flags ?? UP | UV) | AT]),
      new Uint8Array(4),
      new Uint8Array(16),
      new Uint8Array([0, rawId.length]),
      rawId,
      await coseKey(alg, keys.publicKey),
    );
    const attestationObject = cbor(
      new Map<string, Cbor>([
        ["fmt", "none"],
        ["attStmt", new Map()],
        ["authData", authData],
      ]),
    );
    return {
      id: credential.id,
      rawId: credential.id,
      type: "public-key",
      response: {
        clientDataJSON: b64(clientDataJSON),
        attestationObject: b64(attestationObject),
        transports: ["internal"],
      },
      clientExtensionResults: {},
      authenticatorAttachment: "platform",
    };
  }

  async login(
    options: Options,
    {
      credential = this.credentials[0]!,
      ...ceremony
    }: Ceremony & {
      credential?: Credential;
    },
  ) {
    credential.counter = ceremony.counter ?? credential.counter;
    const clientDataJSON = this.clientData("webauthn.get", options, ceremony);
    const counter = new Uint8Array(4);
    new DataView(counter.buffer).setUint32(0, credential.counter);
    const authData = concat(
      sha256(ceremony.rpId),
      new Uint8Array([ceremony.flags ?? UP | UV]),
      counter,
    );
    let signature = new Uint8Array(
      await webcrypto.subtle.sign(
        signParams[credential.alg],
        credential.keys.privateKey,
        concat(authData, sha256(clientDataJSON)),
      ),
    );
    if (credential.alg === -7) signature = der(signature);
    const signedData = ceremony.tamper
      ? new TextEncoder().encode(
          new TextDecoder().decode(clientDataJSON).replace("}", ',"x":1}'),
        )
      : clientDataJSON;
    const userHandle =
      ceremony.userHandle === undefined
        ? credential.userHandle
        : ceremony.userHandle;
    return {
      id: credential.id,
      rawId: credential.id,
      type: "public-key",
      response: {
        clientDataJSON: b64(signedData),
        authenticatorData: b64(authData),
        signature: b64(signature),
        ...(userHandle !== null && { userHandle }),
      },
      clientExtensionResults: {},
      authenticatorAttachment: "platform",
    };
  }

  private clientData(type: string, options: Options, ceremony: Ceremony) {
    return new TextEncoder().encode(
      JSON.stringify({
        type: ceremony.type ?? type,
        challenge: ceremony.challenge ?? options.challenge,
        origin: ceremony.origin,
        crossOrigin: false,
      }),
    );
  }
}
