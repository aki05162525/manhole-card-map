import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dataVersion } from "./data-version.ts";
import { assertPublicData } from "../../src/domain/public-data.ts";
import { publicViews, type Borders } from "../../src/domain/public-views.ts";

const pair = (point: unknown) =>
  Array.isArray(point) &&
  point.length === 2 &&
  point.every((value) => typeof value === "number");
function isBorders(value: unknown): value is Borders {
  if (typeof value !== "object" || value === null || !("features" in value))
    return false;
  const { features } = value;
  return (
    Array.isArray(features) &&
    features.every(
      (line: unknown) =>
        typeof line === "object" &&
        line !== null &&
        "properties" in line &&
        "geometry" in line &&
        typeof line.properties === "object" &&
        line.properties !== null &&
        "p" in line.properties &&
        Array.isArray(line.properties.p) &&
        typeof line.geometry === "object" &&
        line.geometry !== null &&
        "coordinates" in line.geometry &&
        Array.isArray(line.geometry.coordinates) &&
        line.geometry.coordinates.every(pair),
    )
  );
}
// The lines a prefecture shares with its neighbours (`tools/map/`), which
// its file carries to draw it before the map engine.
function borders(): Borders {
  const value: unknown = JSON.parse(
    readFileSync(
      new URL("../../src/pref-borders.json", import.meta.url),
      "utf8",
    ),
  );
  if (!isBorders(value)) throw new Error("pref-borders.json: 形式が一致しない");
  return value;
}

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
  for (const [name, view] of Object.entries(publicViews(data, borders())))
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
