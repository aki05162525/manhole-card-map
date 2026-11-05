// Usage (from web/): mise exec -- node scripts/generate-background.mjs /path/N03-20260101_GML.zip
import { mkdtemp, rm, mkdir, readFile, writeFile } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { gzipSync, brotliCompressSync } from "node:zlib";
import { commandsFor } from "./background-lib.mjs";

const zip = process.argv[2];
if (!zip || process.argv.length !== 3)
  throw new Error(
    "Usage: node scripts/generate-background.mjs /path/N03-20260101_GML.zip",
  );
const hash = createHash("sha256");
for await (const chunk of createReadStream(zip)) hash.update(chunk);
const inputSHA256 = hash.digest("hex");
const temp = await mkdtemp(join(tmpdir(), "manhole-background-"));
const output = resolve("public/background");
const sitesFile = join(temp, "sites.mjs");
await writeFile(
  sitesFile,
  "export default " +
    (await readFile("background/protected-pins.json", "utf8")),
);
const commands = commandsFor(sitesFile);
try {
  const stem = "N03-20260101_prefecture";
  execFileSync("unzip", [
    "-q",
    resolve(zip),
    ...["shp", "shx", "dbf", "prj", "cpg"].map((ext) => `${stem}.${ext}`),
    "-d",
    temp,
  ]);
  // Identical topology/simplification commands to the fixture test; shapefile
  // input avoids parsing the archive's 520 MB duplicate GeoJSON representation.
  execFileSync(
    process.execPath,
    [
      "--max-old-space-size=8192",
      resolve("node_modules/mapshaper/bin/mapshaper"),
      "-i",
      join(temp, `${stem}.shp`),
      ...commands.slice(0, -1),
      join(temp, "background.geojson"),
    ],
    { stdio: "inherit" },
  );
  const bytes = await readFile(join(temp, "background.geojson"));
  const data = JSON.parse(bytes);
  await mkdir(output, { recursive: true });
  await writeFile(join(output, "japan.geojson"), bytes);
  await writeFile(
    join(output, "manifest.json"),
    JSON.stringify(
      {
        source: "国土数値情報（行政区域）2026年1月1日・都道府県界版を加工",
        sourceURL:
          "https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-N03-2026.html",
        license: "CC BY 4.0",
        input: "N03-20260101_GML.zip",
        inputSHA256,
        archiveMembers: ["shp", "shx", "dbf", "prj", "cpg"].map(
          (ext) => `${stem}.${ext}`,
        ),
        mapshaper: JSON.parse(
          await readFile("node_modules/mapshaper/package.json"),
        ).version,
        commands: commandsFor(
          "<temporary module containing background/protected-pins.json>",
        ),
        protectedPinsSHA256: createHash("sha256")
          .update(await readFile("background/protected-pins.json"))
          .digest("hex"),
        minimumUnprotectedIslandAreaM2: 100000,
        protectedPinMarginDegrees: 0.02,
        simplificationThresholdMeters: 100,
        maxZoom: 10,
        features: data.features.length,
        bytes: bytes.length,
        gzipBytes: gzipSync(bytes, { level: 9 }).length,
        brotliDefaultBytes: brotliCompressSync(bytes).length,
        outputSHA256: createHash("sha256").update(bytes).digest("hex"),
      },
      null,
      2,
    ) + "\n",
  );
} finally {
  await rm(temp, { recursive: true, force: true });
}
