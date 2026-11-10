import { base64url } from "../src/shared/universal/base64url";

export { base64url, fromBase64url } from "../src/shared/universal/base64url";

export const randomToken = (size: number) =>
  base64url(crypto.getRandomValues(new Uint8Array(size)));

// Secrets are stored only as this digest (AU-5, AU-8).
export async function sha256Hex(text: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
