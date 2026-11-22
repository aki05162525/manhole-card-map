// 配信素材を配置し、事前圧縮を準備する。
import { readdir, readFile, writeFile, cp, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { checkPublicJSON } from "../deploy/check-deploy.mjs";
import { generateStaticPages } from "./generate-static-pages.mjs";
import { servedData } from "./served-data.ts";
import { fixtureData } from "./fixtures.ts";
import { INDEXNOW_KEY } from "../deploy/indexnow.mjs";
const args = process.argv.slice(2);
if (args.length > 1 || (args.length === 1 && !["--fixture"].includes(args[0])))
  throw new Error("Usage: node scripts/build/prepare.mjs [--fixture]");
const fixture = args[0] === "--fixture";
const output = fixture ? "dist-fixture" : "dist";
await cp(
  new URL("../../public/favicon.svg", import.meta.url),
  `${output}/favicon.svg`,
);
await cp(
  new URL("../../MAPCN_LICENSE.txt", import.meta.url),
  `${output}/MAPCN_LICENSE.txt`,
);
await cp(
  new URL(
    "../../node_modules/@fontsource-variable/noto-sans-jp/LICENSE",
    import.meta.url,
  ),
  `${output}/NOTO_SANS_JP_LICENSE.txt`,
);
await writeFile(`${output}/${INDEXNOW_KEY}.txt`, INDEXNOW_KEY);
if (fixture) {
  await writeFile(
    `${output}/map-style.json`,
    JSON.stringify({
      version: 8,
      name: "Synthetic CI background (not a real basemap)",
      sources: {},
      layers: [
        {
          id: "background",
          type: "background",
          paint: { "background-color": "#e8eeee" },
        },
      ],
    }),
  );
}
// The data files are the same set either way (`served-data.ts`): the whole
// data for the catalog and the map's views of it, with a manifest of them.
let served;
if (fixture) {
  // Synthetic cards for CI/browser tests, never real facilities or card data.
  // Never write to public/ or the real-data dist/ directory.
  served = servedData(JSON.stringify(fixtureData) + "\n", {
    fixture: true,
    purpose:
      "CI/browser synthetic cards with a local blank style; not for deployment",
  });
  await writeFile(
    `${output}/FIXTURE_ONLY.txt`,
    "Synthetic cards for CI/browser tests only. No real cards, PMTiles, fonts or sprites.\n" +
      "Not for deployment or use as real destination data.\n",
  );
} else {
  // Missing real inputs must fail; do not silently fall back to fixtures.
  for (const name of ["_headers", ".assetsignore"])
    await cp(
      new URL("../../deploy/" + name, import.meta.url),
      output + "/" + name,
    );
  // Only full.json crosses the public/build boundary, as `cmd/builddata`
  // wrote it: its manifest names the bytes.
  const full = await readFile("public/data/full.json");
  const written = JSON.parse(await readFile("public/data/manifest.json"));
  if (
    written.files?.["full.json"] !==
    createHash("sha256").update(full).digest("hex")
  )
    throw new Error("public/data/full.json differs from its manifest");
  served = servedData(full);
}
const dataFiles = [...served.files, ["manifest.json", served.manifest]];
for (const [name, bytes] of dataFiles)
  checkPublicJSON(JSON.parse(bytes.toString()), name);
// `/data/` stays at one URL for everything but the pages. A real build's
// pages read the copy named by generation, which browsers keep without
// revalidation; the manifest is not among what they read.
for (const directory of fixture
  ? [`${output}/data`]
  : [`${output}/data`, `${output}/data-v/${served.version}`]) {
  await mkdir(directory, { recursive: true });
  for (const [name, bytes] of dataFiles)
    if (name !== "manifest.json" || directory.endsWith("/data"))
      await writeFile(`${directory}/${name}`, bytes);
}
await generateStaticPages(output);
const files = [
  "/favicon.svg",
  "/index.html",
  "/about.html",
  "/404.html",
  "/account.html",
  "/terms.html",
  "/cards.html",
  "/friends.html",
  "/friends/invite.html",
  "/MAPCN_LICENSE.txt",
  ...(await readdir(`${output}/assets`)).map((f) => "/assets/" + f),
  ...dataFiles.map(([name]) => "/data/" + name),
];
// 配信時の圧縮 CPU 時間を、起動時間に混ぜない。
const { brotliCompressSync, gzipSync, constants } = await import("node:zlib");
for (const f of files) {
  const b = await readFile(output + f);
  await writeFile(
    output + f + ".br",
    brotliCompressSync(b, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }),
  );
  await writeFile(output + f + ".gz", gzipSync(b, { level: 9 }));
}
