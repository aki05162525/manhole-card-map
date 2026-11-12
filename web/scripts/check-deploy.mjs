import { readFile, readdir, lstat, access } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import { dataVersion } from "./data-version.ts";
import {
  embedCatalogSummary,
  summarizeCatalog,
} from "../src/domain/catalog-summary.ts";
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
// Worker sources and account SQL must stay out of the browser bundle.
const workerCode =
  /__Host-session|\b(?:FROM|INTO|UPDATE|JOIN|TABLE)\s+(?:users|credentials|recovery_codes|sessions|challenges|records|invites|friend_requests|friendships|blocks|tombstones)\b/;
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
// The map's code: MapLibre and its worker, the mapcn stage and the map's CSS.
const mapCode =
  /maplibre|map-style|map-stage|mapcn\.css|new\s+Worker|worker[^"'`]*\.m?js/i;
// The map screen as the catalog's document loads it on a switch
// (`src/app/map-screen.tsx`), and what Vite preloads with it.
const mapSwitch = /\/assets\/map-screen-[\w-]+\.js$/;
const staticImport =
  /\b(?:import|export)\s*(?:[\w$*{}\s,]+?\s*from\s*)?["'`](\.{1,2}\/[^"'`]+\.m?js)["'`]/g;
const dynamicImport = /\bimport\(\s*["'`](\.{1,2}\/[^"'`]+\.m?js)["'`]\s*\)/g;
// Vite lists every file a chunk's dynamic imports preload once, and each
// import call names its own entries by index right after the import.
const preloadList = /m\.f=(\[[^\]]*\])/;
const preloadCall = /__vite__mapDeps\(\[([\d,]*)\]\)/g;
/** A module's imports: static ones, and each dynamic one with its preloads. */
function moduleImports(source) {
  const list = JSON.parse(source.match(preloadList)?.[1] ?? "[]");
  const dynamic = [...source.matchAll(dynamicImport)].map((match) => ({
    at: match.index,
    target: match[1],
    preloads: [],
  }));
  for (const call of source.matchAll(preloadCall)) {
    const owner = dynamic.findLast((item) => item.at < call.index);
    if (!owner) continue;
    for (const index of call[1].split(",").filter(Boolean))
      owner.preloads.push("/" + list[Number(index)]);
  }
  const withoutDynamic = source.replace(dynamicImport, "");
  return {
    static: [...withoutDynamic.matchAll(staticImport)].map((match) => match[1]),
    dynamic,
  };
}
/**
 * What the pages load before any switch: the HTML's assets, static imports,
 * and dynamic imports with their preloads. None of it may be map code. The
 * catalog alone may import the map screen dynamically, for the switch; that
 * import and its preloads are not part of its first view.
 */
export async function checkCatalogDependencies(directory) {
  const root = resolve(directory);
  const seen = new Set();
  async function visit(file, page) {
    if (seen.has(file)) return;
    seen.add(file);
    if (!file.startsWith(root + "/"))
      throw new Error("Invalid catalog asset path");
    const source = await readFile(file, "utf8");
    if (file.endsWith(".html")) {
      for (const [tag] of source.matchAll(
        /<script\b(?=[^>]*\btype=["']module["'])[^>]*>/g,
      ))
        if (!/\bblocking=["']render["']/.test(tag))
          throw new Error("Document render block missing: " + file);
    }
    // The preload list only names files; each is checked when visited.
    if (mapSwitch.test(file) || mapCode.test(source.replace(preloadList, "")))
      throw new Error("Catalog map dependency: " + file);
    const at = (reference) =>
      reference.startsWith("/")
        ? resolve(root, "." + reference)
        : resolve(file, "..", reference);
    const next = [];
    if (file.endsWith(".html"))
      next.push(
        ...[
          ...source.matchAll(/(?:src|href)=["']([^"']+\.(?:m?js|css))["']/g),
        ].map((match) => match[1]),
      );
    else if (/\.m?js$/.test(file)) {
      const imports = moduleImports(source);
      next.push(...imports.static);
      for (const { target, preloads } of imports.dynamic)
        if (!(page === "cards.html" && mapSwitch.test(at(target))))
          next.push(target, ...preloads);
    }
    for (const reference of next) await visit(at(reference), page);
  }
  for (const page of [
    "cards.html",
    "about.html",
    "404.html",
    "account.html",
    "terms.html",
    "friends.html",
    "friends/invite.html",
  ]) {
    seen.clear();
    await visit(resolve(root, page), page);
  }
}
// PF-1: the browsing pages may reach passkey code only through a dynamic
// import, so follow static imports and HTML module references alone.
const passkeyCode = /navigator\.credentials|\/api\/auth\//;
export async function checkAuthBoundary(directory) {
  const root = resolve(directory);
  for (const page of [
    "index.html",
    "cards.html",
    "about.html",
    "404.html",
    "terms.html",
    "friends.html",
    "friends/invite.html",
  ]) {
    const seen = new Set();
    const visit = async (file) => {
      if (seen.has(file)) return;
      seen.add(file);
      if (!file.startsWith(root + "/")) throw new Error("Invalid asset path");
      const source = await readFile(file, "utf8");
      if (passkeyCode.test(source))
        throw new Error(`Passkey code in ${page}: ${file}`);
      const references = file.endsWith(".html")
        ? [...source.matchAll(/(?:src|href)=["']([^"']+\.m?js)["']/g)]
        : [
            ...source.matchAll(
              /\b(?:import|export)\s*(?:[\w$*{}\s,]+?\s*from\s*)?["'](\.{1,2}\/[^"']+\.m?js)["']/g,
            ),
          ];
      for (const [, reference] of references)
        await visit(
          reference.startsWith("/")
            ? resolve(root, "." + reference)
            : resolve(file, "..", reference),
        );
    };
    await visit(resolve(root, page));
  }
}
// The map and the catalog preload the data their fetch reads, and the
// catalog's first view is counted from those same bytes.
export async function checkFirstView(directory, dataHref) {
  const root = resolve(directory);
  for (const page of ["index.html", "cards.html"]) {
    const html = await readFile(resolve(root, page), "utf8");
    const preloads = [...html.matchAll(/<link\b[^>]*\brel="preload"[^>]*>/g)];
    if (
      preloads.length !== 1 ||
      !preloads[0][0].includes(` href="${dataHref}"`) ||
      !/\bas="fetch"/.test(preloads[0][0]) ||
      !/\bcrossorigin\b/.test(preloads[0][0])
    )
      throw new Error(`${page}: preload of ${dataHref}`);
    if (page !== "cards.html") continue;
    const data = JSON.parse(await readFile(resolve(root, "." + dataHref)));
    const summary = embedCatalogSummary(
      "data-catalog-summary",
      summarizeCatalog(data),
    );
    if (!html.includes(` ${summary}>`))
      throw new Error(`${page}: summary differs from ${dataHref}`);
  }
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
    "404.html",
    "cards.html",
    "account.html",
    "terms.html",
    "friends.html",
    "friends/invite.html",
    ...["full", "pins", "details", "manifest"].map(
      (n) => "data/" + n + ".json",
    ),
  ])
    await access(resolve(root, name));
  await checkCatalogDependencies(root);
  await checkAuthBoundary(root);
  const manifestBytes = await readFile(resolve(root, "data/manifest.json"));
  const manifest = JSON.parse(manifestBytes.toString());
  if (manifest.fixture) throw new Error("Fixture manifest");
  checkPublicJSON(manifest);
  for (const [name, hash] of Object.entries(manifest.files)) {
    const file = resolve(root, "data", name);
    if (!file.startsWith(root + "/data/"))
      throw new Error("Invalid manifest path");
    // The copy the pages read (`data-v/<generation>/`) is the same bytes.
    for (const copy of [
      file,
      resolve(root, "data-v", dataVersion(manifestBytes), name),
    ])
      if (
        createHash("sha256")
          .update(await readFile(copy))
          .digest("hex") !== hash
      )
        throw new Error("Hash mismatch: " + relative(root, copy));
  }
  await checkFirstView(root, `/data-v/${dataVersion(manifestBytes)}/full.json`);
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
        name.endsWith(".sql") ||
        (/\.(?:m?js|html)$/.test(name) &&
          workerCode.test(await readFile(file, "utf8")))
      )
        throw new Error("Worker code in assets: " + relative);
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
