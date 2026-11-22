import { createHash } from "node:crypto";

// The build's manifest (`served-data.ts`) lists each served data file's hash,
// so its own hash names the generation. The build and the pages agree on
// `/data-v/<version>/`.
export const dataVersion = (manifest: Uint8Array | string) =>
  createHash("sha256").update(manifest).digest("hex").slice(0, 16);
