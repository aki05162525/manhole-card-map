import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { experimental_readRawConfig } from "wrangler";

export const readConfig = (config) =>
  experimental_readRawConfig({ config }).rawConfig;

const hasD1 = (value) =>
  !!value &&
  typeof value === "object" &&
  Object.entries(value).some(
    ([key, item]) => key === "d1_databases" || hasD1(item),
  );

// A preview version runs PR code with the bindings of its own config, so it
// must never carry D1 (TE-1). Environments are dropped with their bindings.
export function previewConfig(config) {
  const preview = structuredClone(config);
  delete preview.env;
  delete preview.d1_databases;
  if (hasD1(preview)) throw new Error("Preview config still has D1");
  return preview;
}

export async function writePreviewConfig(source, out) {
  await writeFile(out, JSON.stringify(previewConfig(readConfig(source))));
  // Re-read as Wrangler does, so a parse difference cannot hide a binding.
  if (hasD1(readConfig(out))) throw new Error("Preview config still has D1");
}

// Top-level only: env.dev is local and never deployed.
export const d1Bindings = (config) =>
  (config.d1_databases ?? []).map((database) => database.binding);

// The Worker answers /api/* with 404 until the DB binding exists.
export const apiHealth = (config) =>
  d1Bindings(config).includes("DB") ? "enabled" : "disabled";

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const [command, out] = process.argv.slice(2);
  if (command === "preview" && out)
    await writePreviewConfig("wrangler.jsonc", out);
  else if (command === "d1")
    console.log(d1Bindings(readConfig("wrangler.jsonc")).join("\n"));
  else if (command === "api-health")
    console.log(apiHealth(readConfig("wrangler.jsonc")));
  else
    throw new Error(
      "Usage: wrangler-config.mjs preview <out> | d1 | api-health",
    );
}
