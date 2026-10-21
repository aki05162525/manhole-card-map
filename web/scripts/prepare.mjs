// ビルドした画面とカードデータだけを保存する。背景地図は対象外。
import { readdir, readFile, writeFile, cp, symlink } from "node:fs/promises";
import { createHash } from "node:crypto";
for (const name of ["data", "fonts", "sprites"])
  await cp("public/" + name, "dist/" + name, { recursive: true });
await symlink("../public/maps", "dist/maps", "dir");
const files = [
  "/index.html",
  ...(await readdir("dist/assets")).map((f) => "/assets/" + f),
  "/data/full.json",
  "/data/details.json",
  "/data/pins.json",
  "/data/manifest.json",
];
const hash = createHash("sha256");
for (const f of files) hash.update(await readFile("dist" + f));
const version = "prototype-" + hash.digest("hex").slice(0, 16);
await writeFile(
  "dist/sw.js",
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
  const b = await readFile("dist" + f);
  await writeFile(
    "dist" + f + ".br",
    brotliCompressSync(b, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }),
  );
  await writeFile("dist" + f + ".gz", gzipSync(b, { level: 9 }));
}
