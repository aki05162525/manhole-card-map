import { createHash } from "node:crypto";
import { dataVersion } from "./data-version.ts";
import { assertPublicData } from "../../src/domain/public-data.ts";
import { publicViews } from "../../src/domain/public-views.ts";

const sha256 = (bytes: Uint8Array | string) =>
  createHash("sha256").update(bytes).digest("hex");

/**
 * Every data file the site serves, cut from the one `full.json` that
 * `cmd/builddata` writes: that file itself for the catalog, and the map's
 * views of it (`src/domain/public-views.ts`). The manifest names them all,
 * so a change to how the views are cut is a new generation as well.
 */
export function servedData(
  full: Uint8Array | string,
  extra: Record<string, unknown> = {},
) {
  const data: unknown = JSON.parse(
    typeof full === "string" ? full : new TextDecoder().decode(full),
  );
  assertPublicData("full", data);
  const files = new Map<string, Uint8Array | string>([["full.json", full]]);
  for (const [name, view] of Object.entries(publicViews(data)))
    files.set(name, JSON.stringify(view) + "\n");
  const manifest =
    JSON.stringify({
      schema: data.schema,
      updated: data.updated,
      ...extra,
      files: Object.fromEntries(
        [...files]
          .map(([name, bytes]) => [name, sha256(bytes)] as const)
          .sort(([a], [b]) => (a < b ? -1 : 1)),
      ),
    }) + "\n";
  return { files, manifest, version: dataVersion(manifest) };
}
