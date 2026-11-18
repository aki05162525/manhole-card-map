import { afterEach, expect, it, vi } from "vitest";
import { signalPasskeys, signalUnknownPasskey } from "./passkey-signals";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const account = { rpId: "manhole-techo.com", userId: "dXNlci0x" };

// The browser throws on these; the page skips them instead.
it.each([
  ["padding", "cGFzc2tleQ=="],
  ["a length base64url never has", "abcde"],
  ["a character outside the alphabet", "cred:1"],
  ["nothing", ""],
])("does not signal an ID with %s", (_, id) => {
  const signalAllAcceptedCredentials = vi.fn(async () => {});
  const signalUnknownCredential = vi.fn(async () => {});
  vi.stubGlobal("PublicKeyCredential", {
    signalAllAcceptedCredentials,
    signalUnknownCredential,
  });
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  signalPasskeys(account, ["cDE", id]);
  signalPasskeys({ ...account, userId: id }, ["cDE"]);
  signalUnknownPasskey(account.rpId, id);
  expect(signalAllAcceptedCredentials).not.toHaveBeenCalled();
  expect(signalUnknownCredential).not.toHaveBeenCalled();
  expect(warn).toHaveBeenCalledTimes(3);
});

it("does not signal without the RP ID of the server", () => {
  const signalUnknownCredential = vi.fn(async () => {});
  vi.stubGlobal("PublicKeyCredential", { signalUnknownCredential });
  vi.spyOn(console, "warn").mockImplementation(() => {});
  signalUnknownPasskey(undefined, "cDE");
  expect(signalUnknownCredential).not.toHaveBeenCalled();
});

it("does nothing where passkeys do not exist at all", () => {
  vi.stubGlobal("PublicKeyCredential", undefined);
  expect(() => signalPasskeys(account, ["cDE"])).not.toThrow();
});
