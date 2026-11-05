// 配信素材を配置し、画面とカードデータのオフライン保存・事前圧縮を準備する。
import {
  readdir,
  readFile,
  writeFile,
  cp,
  symlink,
  mkdir,
  access,
} from "node:fs/promises";
import { createHash } from "node:crypto";
const args = process.argv.slice(2);
if (args.length > 1 || (args.length === 1 && args[0] !== "--fixture"))
  throw new Error("Usage: node scripts/prepare.mjs [--fixture]");
const fixture = args[0] === "--fixture";
const output = fixture ? "dist-fixture" : "dist";
if (fixture) {
  // Build-only fixture: deliberately no real cards, fonts, sprites or PMTiles.
  // Never write to public/ or the real-data dist/ directory.
  await mkdir(`${output}/data`, { recursive: true });
  const data = {
    schema: 1,
    updated: "1970-01-01T00:00:00Z",
    cards: [],
    places: [],
    relations: [],
    pins: [],
  };
  const files = {};
  async function writeFixture(name, value) {
    const bytes = JSON.stringify(value) + "\n";
    await writeFile(`${output}/data/${name}`, bytes);
    return createHash("sha256").update(bytes).digest("hex");
  }
  files["full.json"] = await writeFixture("full.json", data);
  files["details.json"] = await writeFixture("details.json", {
    ...data,
    pins: null,
  });
  files["pins.json"] = await writeFixture("pins.json", {
    schema: data.schema,
    updated: data.updated,
    pins: data.pins,
    detailsSHA256: files["details.json"],
  });
  await writeFixture("manifest.json", {
    schema: data.schema,
    updated: data.updated,
    fixture: true,
    purpose: "CI build only; no real map assets",
    files,
    inputs: {},
    referencePlaces: false,
  });
  await writeFile(
    `${output}/FIXTURE_ONLY.txt`,
    "CI build fixture only. Empty synthetic card data. No PMTiles, fonts or sprites.\n" +
      "Not a deployable map or a substitute for real-data/browser verification.\n",
  );
} else {
  // Missing real inputs must fail; do not silently fall back to fixtures.
  for (const name of ["data", "fonts", "sprites", "maps/japan.pmtiles"])
    await access(`public/${name}`);
  for (const name of ["data", "fonts", "sprites"])
    await cp(`public/${name}`, `${output}/${name}`, { recursive: true });
  await symlink("../public/maps", `${output}/maps`, "dir");
}
const files = [
  "/index.html",
  ...(await readdir(`${output}/assets`)).map((f) => "/assets/" + f),
  "/data/full.json",
  "/data/details.json",
  "/data/pins.json",
  "/data/manifest.json",
];
const hash = createHash("sha256");
for (const f of files) hash.update(await readFile(output + f));
const version =
  (fixture ? "prototype-fixture-" : "prototype-") +
  hash.digest("hex").slice(0, 16);
await writeFile(
  `${output}/sw.js`,
  `const CACHE=${JSON.stringify(version)},FILES=${JSON.stringify(files)};
self.addEventListener('install',e=>e.waitUntil((async()=>{const c=await caches.open(CACHE);await c.addAll(FILES);await self.skipWaiting()})()));
self.addEventListener('activate',e=>e.waitUntil((async()=>{for(const key of await caches.keys())if(key.startsWith('prototype-')&&key!==CACHE)await caches.delete(key);await self.clients.claim()})()));
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(u.origin!==location.origin)return;if(e.request.mode==='navigate'){e.respondWith(caches.open(CACHE).then(c=>c.match('/index.html')).then(r=>r||fetch(e.request)));return}if(FILES.includes(u.pathname))e.respondWith(caches.open(CACHE).then(c=>c.match(u.pathname)).then(r=>r||fetch(e.request)))});
self.addEventListener('message',e=>{if(e.data.type==='status')e.waitUntil((async()=>{const c=await caches.open(CACHE);const ready=(await Promise.all(FILES.map(f=>c.match(f)))).every(Boolean);e.ports[0].postMessage({ready,version:CACHE})})())});
`,
);
// 配信時の圧縮 CPU 時間を、起動時間に混ぜない。
const { brotliCompressSync, gzipSync, constants } = await import("node:zlib");
for (const f of [...files, "/sw.js"]) {
  const b = await readFile(output + f);
  await writeFile(
    output + f + ".br",
    brotliCompressSync(b, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }),
  );
  await writeFile(output + f + ".gz", gzipSync(b, { level: 9 }));
}
