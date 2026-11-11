import { createHash } from "node:crypto";

// The manifest lists each data file's hash, so its own hash names the
// generation. The build and the pages agree on `/data-v/<version>/`.
export const dataVersion = (manifest: Uint8Array | string) =>
  createHash("sha256").update(manifest).digest("hex").slice(0, 16);
