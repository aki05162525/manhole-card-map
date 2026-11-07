import { readFile, readdir, lstat, access } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
const forbiddenKeys = new Set([
  "snapshotPath",
  "snapshotSHA256",
  "sourceLocator",
  "verificationMethod",
  "actorType",
  "inputs",
  "reviewSource",
  "reviewSourceHash",
  "override",
  "reviewer",
]);
const localPath =
  /(?:\/tmp\/|\/home\/|data\/(?:work|raw|evidence)\/|docs\/verification\/)/;
// Inspect parsed strings, including JSON-escaped paths, at every nesting depth.
export function checkPublicJSON(value, path = "$", coordinate = false) {
  if (typeof value === "string" && localPath.test(value))
    throw new Error("Local path: " + path);
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => checkPublicJSON(item, `${path}[${index}]`));
    return;
  }
  for (const [key, item] of Object.entries(value)) {
    if (forbiddenKeys.has(key))
      throw new Error("Forbidden key: " + path + "." + key);
    if (coordinate && !["lat", "lng", "status"].includes(key))
      throw new Error("Coordinate key: " + key);
    checkPublicJSON(
      item,
      `${path}.${key}`,
      key === "coordinate" && /\.places\[\d+\]$/.test(path),
    );
  }
}
// Follow HTML assets and static/dynamic JS imports, including shared chunks.
export async function checkCatalogDependencies(directory) {
  const root = resolve(directory);
  const seen = new Set();
  async function visit(file) {
    if (seen.has(file)) return;
    seen.add(file);
    if (!file.startsWith(root + "/"))
      throw new Error("Invalid catalog asset path");
    const source = await readFile(file, "utf8");
    if (
      /maplibre|map-style|map-stage|mapcn\.css|new\s+Worker|worker[^"'`]*\.m?js/i.test(
        source,
      )
    )
      throw new Error("Catalog map dependency: " + file);
    const references = file.endsWith(".html")
      ? [
          ...source.matchAll(/(?:src|href)=["']([^"']+\.(?:m?js|css))["']/g),
        ].map((match) => match[1])
      : [
          ...source.matchAll(
            /["']((?:\.\.?\/|\/assets\/)[^"']+\.(?:m?js|css))["']/g,
          ),
        ].map((match) => match[1]);
    for (const reference of references) {
      const next = reference.startsWith("/")
        ? resolve(root, "." + reference)
        : resolve(file, "..", reference);
      await visit(next);
    }
  }
  await visit(resolve(root, "cards.html"));
}
export async function checkDeploy(directory = "dist") {
  const root = resolve(directory);
  const exists = async (name) =>
    access(resolve(root, name)).then(
      () => true,
      () => false,
    );
  for (const name of [
    "FIXTURE_ONLY.txt",
    "sw.js",
    "data/quality.json",
    "data/quality.json.gz",
    "data/quality.json.br",
  ])
    if (await exists(name)) throw new Error("Forbidden: " + name);
  for (const name of [
    "index.html",
    "about.html",
    "cards.html",
    ...["full", "pins", "details", "manifest"].map(
      (n) => "data/" + n + ".json",
    ),
  ])
    await access(resolve(root, name));
  await checkCatalogDependencies(root);
  const manifest = JSON.parse(
    await readFile(resolve(root, "data/manifest.json"), "utf8"),
  );
  if (manifest.fixture) throw new Error("Fixture manifest");
  checkPublicJSON(manifest);
  for (const [name, hash] of Object.entries(manifest.files)) {
    const file = resolve(root, "data", name);
    if (!file.startsWith(root + "/data/"))
      throw new Error("Invalid manifest path");
    if (
      createHash("sha256")
        .update(await readFile(file))
        .digest("hex") !== hash
    )
      throw new Error("Hash mismatch: " + name);
  }
  let count = 0;
  async function walk(dir, prefix = "") {
    for (const name of await readdir(dir)) {
      const relative = prefix + name;
      const file = resolve(dir, name);
      const stat = await lstat(file);
      if (stat.isSymbolicLink()) throw new Error("Symlink: " + relative);
      if (stat.isDirectory()) {
        await walk(file, relative + "/");
        continue;
      }
      if (name.endsWith(".json"))
        checkPublicJSON(JSON.parse(await readFile(file, "utf8")), relative);
      if (
        /\.(br|gz)$/.test(name) ||
        ["_headers", ".assetsignore"].includes(relative)
      )
        continue;
      if (stat.size > 25 * 1024 * 1024)
        throw new Error("Oversized: " + relative);
      count++;
    }
  }
  await walk(root);
  if (count > 20000) throw new Error("Too many assets");
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
)
  await checkDeploy(process.argv[2]);
