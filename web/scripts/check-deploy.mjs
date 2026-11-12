import { readFile, readdir, lstat, access } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import { parseAst } from "vite";
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
// The screens one document switches between (`src/app/*-screen.tsx`), each
// its own chunk, and the page whose document starts with each.
const screenChunk =
  /\/assets\/(map|catalog|friends|account)-screen-[\w-]+\.js$/;
const screenPages = {
  "index.html": "map",
  "cards.html": "catalog",
  "friends.html": "friends",
  "account.html": "account",
};
// Vite lists every file a chunk's dynamic imports preload once, and each
// import's preload call names its own entries by index.
const preloadList = /m\.f=(\[[^\]]*\])/;
const literal = (node) =>
  node?.type === "Literal"
    ? node.value
    : node?.type === "TemplateLiteral" && !node.expressions.length
      ? node.quasis[0].value.cooked
      : null;
const isFunction = (node) =>
  /Function(?:Expression|Declaration)$/.test(node?.type);
// `helper(() => import(chunk), __vite__mapDeps([indices]))`.
const preloadIndices = (call) =>
  call?.type === "CallExpression" &&
  call.callee.type === "Identifier" &&
  call.callee.name === "__vite__mapDeps" &&
  call.arguments[0]?.type === "ArrayExpression"
    ? call.arguments[0].elements.map((element) => element.value)
    : null;
/**
 * A module's imports, read from its syntax tree: static ones, and each
 * dynamic one with its preloads and whether a function holds it (other
 * than the arrow Vite wraps every dynamic import in).
 */
function moduleImports(source) {
  const list = JSON.parse(source.match(preloadList)?.[1] ?? "[]");
  const found = { static: [], dynamic: [] };
  const visit = (node, depth, preloads) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (const item of node) visit(item, depth, preloads);
      return;
    }
    if (typeof node.type !== "string") return;
    if (
      /^(?:Import|ExportNamed|ExportAll)Declaration$/.test(node.type) &&
      literal(node.source)
    )
      found.static.push(literal(node.source));
    if (node.type === "ImportExpression" && literal(node.source)) {
      found.dynamic.push({
        target: literal(node.source),
        preloads: (preloads ?? []).map((index) => "/" + list[index]),
        inFunction: depth > 0,
      });
      return;
    }
    if (node.type === "CallExpression" && isFunction(node.arguments[0])) {
      const indices = preloadIndices(node.arguments[1]);
      const [wrapper, ...rest] = node.arguments;
      if (
        indices ||
        (node.arguments.length === 1 &&
          wrapper.body.type === "ImportExpression")
      ) {
        visit(node.callee, depth, preloads);
        visit(wrapper.body, depth, indices);
        visit(rest, depth, preloads);
        return;
      }
    }
    const inner = isFunction(node) ? depth + 1 : depth;
    for (const [key, value] of Object.entries(node))
      if (key !== "type") visit(value, inner, preloads);
  };
  visit(parseAst(source).body, 0, null);
  return found;
}
/**
 * What a page loads before any switch: the HTML's assets, static imports,
 * and dynamic imports with their preloads; `check` sees each file. A page
 * that starts the screens may import another screen dynamically, for the
 * switch to it: that import and its preloads are not part of its first view
 * when a function holds it. At the module's top level it runs with the page.
 */
async function walkFirstView(root, page, check) {
  const seen = new Set();
  const own = screenPages[page];
  async function visit(file) {
    if (seen.has(file)) return;
    seen.add(file);
    if (!file.startsWith(root + "/")) throw new Error("Invalid asset path");
    const source = await readFile(file, "utf8");
    check(file, source);
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
      for (const { target, preloads, inFunction } of imports.dynamic) {
        const screen = at(target).match(screenChunk)?.[1];
        if (own && screen && screen !== own && inFunction) continue;
        next.push(target, ...preloads);
      }
    }
    for (const reference of next) await visit(at(reference));
  }
  await visit(resolve(root, page));
}
/** No page but the map's loads map code before a switch to the map. */
export async function checkCatalogDependencies(directory) {
  const root = resolve(directory);
  for (const page of [
    "cards.html",
    "about.html",
    "404.html",
    "account.html",
    "terms.html",
    "friends.html",
    "friends/invite.html",
  ])
    await walkFirstView(root, page, (file, source) => {
      if (file.endsWith(".html"))
        for (const [tag] of source.matchAll(
          /<script\b(?=[^>]*\btype=["']module["'])[^>]*>/g,
        ))
          if (!/\bblocking=["']render["']/.test(tag))
            throw new Error("Document render block missing: " + file);
      // The preload list only names files; each is checked when visited.
      if (
        screenChunk.exec(file)?.[1] === "map" ||
        mapCode.test(source.replace(preloadList, ""))
      )
        throw new Error("Catalog map dependency: " + file);
    });
}
// PF-1: passkey code loads with the account page, or with a switch to it.
// The account screen counts by its name too: a build without accounts has
// none of that code, and the same import would bring it in one with them.
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
  ])
    await walkFirstView(root, page, (file, source) => {
      if (screenChunk.exec(file)?.[1] === "account" || passkeyCode.test(source))
        throw new Error(`Passkey code in ${page}: ${file}`);
    });
}
// The map preloads the pins and, at low priority, the details its fetches
// read; the catalog preloads the full data, and its first view is counted
// from those same bytes. `dataPath` is where the pages read the data.
const firstViewData = {
  "index.html": [
    ["pins.json", false],
    ["details.json", true],
  ],
  "cards.html": [["full.json", false]],
};
export async function checkFirstView(directory, dataPath) {
  const root = resolve(directory);
  for (const [page, files] of Object.entries(firstViewData)) {
    const html = await readFile(resolve(root, page), "utf8");
    const preloads = [...html.matchAll(/<link\b[^>]*\brel="preload"[^>]*>/g)];
    if (
      preloads.length !== files.length ||
      files.some(
        ([file, low], index) =>
          !preloads[index][0].includes(` href="${dataPath}/${file}"`) ||
          !/\bas="fetch"/.test(preloads[index][0]) ||
          !/\bcrossorigin\b/.test(preloads[index][0]) ||
          /\bfetchpriority="low"/.test(preloads[index][0]) !== low,
      )
    )
      throw new Error(`${page}: preload of ${dataPath}`);
    if (page !== "cards.html") continue;
    const dataHref = `${dataPath}/full.json`;
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
  await checkFirstView(root, `/data-v/${dataVersion(manifestBytes)}`);
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
