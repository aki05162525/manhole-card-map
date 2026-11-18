import { afterEach, expect, it, vi } from "vitest";
import { addPasskey, createPasskey, getPasskey } from "./webauthn";

import { ApiError, type Operation } from "../../session/account-api";

afterEach(() => vi.unstubAllGlobals());

const bytes = Uint8Array.of(0xfb, 0xff, 0xfe, 0x01);
const text = "-__-AQ";
class Attestation {
  clientDataJSON = bytes.buffer;
  attestationObject = Uint8Array.of(0xfb, 0xff).buffer;
}
class Assertion {
  clientDataJSON = bytes.buffer;
  authenticatorData = Uint8Array.of(1).buffer;
  signature = Uint8Array.of(0xff, 0xff, 0xff).buffer;
  userHandle = bytes.buffer;
}
// Safari before 18.4: no JSON helpers on either side of the ceremony.
function stub(response: object) {
  const create = vi.fn<(options: CredentialCreationOptions) => unknown>(
    async () => credential,
  );
  const get = vi.fn<(options: CredentialRequestOptions) => unknown>(
    async () => credential,
  );
  const credential = {
    id: text,
    rawId: bytes.buffer,
    type: "public-key",
    authenticatorAttachment: null,
    getClientExtensionResults: () => ({}),
    response,
  };
  vi.stubGlobal("PublicKeyCredential", {});
  vi.stubGlobal("AuthenticatorAttestationResponse", Attestation);
  vi.stubGlobal("AuthenticatorAssertionResponse", Assertion);
  vi.stubGlobal("navigator", { credentials: { create, get } });
  return { create, get };
}

it("decodes creation options and encodes the attestation as base64url", async () => {
  const { create } = stub(new Attestation());
  const result = await createPasskey({
    challenge: text,
    rp: { name: "rp" },
    user: { id: "AQID", name: "n", displayName: "d" },
    pubKeyCredParams: [],
    excludeCredentials: [{ id: "-__-", type: "public-key" }],
  });
  const options = create.mock.lastCall![0].publicKey!;
  expect(options.challenge).toEqual(bytes);
  expect(options.user.id).toEqual(Uint8Array.of(1, 2, 3));
  expect(options.excludeCredentials![0].id).toEqual(
    Uint8Array.of(0xfb, 0xff, 0xfe),
  );
  expect(result).toMatchObject({
    id: text,
    rawId: text,
    response: {
      clientDataJSON: text,
      attestationObject: "-_8",
      transports: [],
    },
  });
});

it("decodes request options and encodes the assertion as base64url", async () => {
  const { get } = stub(new Assertion());
  const result = await getPasskey({
    challenge: text,
    allowCredentials: [{ id: "AQ", type: "public-key" }],
  });
  const options = get.mock.lastCall![0].publicKey!;
  expect(options.challenge).toEqual(bytes);
  expect(options.allowCredentials![0].id).toEqual(Uint8Array.of(1));
  expect(result).toMatchObject({
    rawId: text,
    response: {
      clientDataJSON: text,
      authenticatorData: "AQ",
      signature: "____",
      userHandle: text,
    },
  });
});

// The options and verification boundaries can independently require a fresh check.
it.each(["options", "verify"])(
  "reauthenticates at registration %s without recreating a credential",
  async (stage) => {
    const { create, get } = stub(new Attestation());
    const calls: string[] = [];
    let verified = false;
    const api = async (path: string) => {
      calls.push(path);
      if (path === `/api/passkeys/register/${stage}` && !verified)
        throw new ApiError(403, "reauth_required");
      if (path === "/api/auth/reauth/verify") verified = true;
      if (path === "/api/auth/reauth/options") return { challenge: text };
      if (path === "/api/passkeys/register/options")
        return {
          challenge: text,
          rp: { name: "rp" },
          user: { id: "AQID", name: "n", displayName: "d" },
          pubKeyCredParams: [],
        };
      return { displayName: "Alice", passkeys: 2 };
    };
    const owner = { mark: "m1", epoch: 0 };
    const operation = {
      owner,
      api,
      owned: async (path: string) => ({ value: await api(path), owner }),
    } as unknown as Operation;
    // The profile, with the owner it was taken for.
    expect(await addPasskey(operation)).toMatchObject({
      value: { passkeys: 2 },
      owner,
    });
    expect(create).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenCalledTimes(1);
    expect(
      calls.filter((path) => path === `/api/passkeys/register/${stage}`),
    ).toHaveLength(2);
  },
);
