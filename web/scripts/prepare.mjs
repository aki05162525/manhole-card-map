// 配信素材を配置し、事前圧縮を準備する。
import {
  readdir,
  readFile,
  writeFile,
  cp,
  mkdir,
  access,
} from "node:fs/promises";
import { createHash } from "node:crypto";
import { fixtureData } from "./fixtures.ts";
const args = process.argv.slice(2);
if (args.length > 1 || (args.length === 1 && !["--fixture"].includes(args[0])))
  throw new Error("Usage: node scripts/prepare.mjs [--fixture]");
const fixture = args[0] === "--fixture";
const output = fixture ? "dist-fixture" : "dist";
await cp(
  new URL("../MAPCN_LICENSE.txt", import.meta.url),
  `${output}/MAPCN_LICENSE.txt`,
);
// Keep MapLibre's module worker and its relative shared import on our origin.
const workers = ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"];
for (const name of workers) {
  await cp(
    new URL(`../node_modules/maplibre-gl/dist/${name}`, import.meta.url),
    `${output}/${name}`,
  );
}
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
if (fixture) {
  // Synthetic cards for CI/browser tests, never real facilities or card data.
  // Never write to public/ or the real-data dist/ directory.
  await mkdir(`${output}/data`, { recursive: true });
  const data = fixtureData;
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
    purpose:
      "CI/browser synthetic cards with a local blank style; not for deployment",
    files,
    inputs: {},
    referencePlaces: false,
  });
  await writeFile(
    `${output}/FIXTURE_ONLY.txt`,
    "Synthetic cards for CI/browser tests only. No real cards, PMTiles, fonts or sprites.\n" +
      "Not for deployment or use as real destination data.\n",
  );
} else {
  // Missing real inputs must fail; do not silently fall back to fixtures.
  await access("public/data");
  await cp("public/data", `${output}/data`, { recursive: true });
}
const files = [
  "/index.html",
  "/MAPCN_LICENSE.txt",
  ...workers.map((name) => "/" + name),
  ...(await readdir(`${output}/assets`)).map((f) => "/assets/" + f),
  "/data/full.json",
  "/data/details.json",
  "/data/pins.json",
  "/data/manifest.json",
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
