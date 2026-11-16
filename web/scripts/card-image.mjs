// Prepares a card image a municipality permitted and puts it in KV:
//   node scripts/card-image.mjs <card ID> <original> [--upload]
// Write the permission into ../data/card-images.json first (cardId, grantor,
// credit, received, terms). This fills in sourceSha256, key, width and
// height, keeps the served file in ../data/work/card-images/ (outside Git),
// and with --upload puts it in the production KV namespace.
//
// Every permission is for the whole card, unaltered: the image is only
// scaled down at its own proportions, re-encoded and stripped of metadata
// (Exif, XMP, IPTC, ICC). Never crop, filter or draw on it.
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import sharp from "sharp";

// The detail shows it at most 320 CSS pixels wide: enough for 2x screens.
export const servedWidth = 640;

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

export async function prepareCardImage(cardId, original) {
  const { data, info } = await sharp(original)
    // Turned as the camera meant; the pixels are not changed otherwise.
    .autoOrient()
    .resize({ width: servedWidth, withoutEnlargement: true })
    // sharp writes no metadata unless asked to keep it.
    .webp({ quality: 82 })
    .toBuffer({ resolveWithObject: true });
  return {
    bytes: data,
    key: `${cardId}-${sha256(data).slice(0, 16)}.webp`,
    width: info.width,
    height: info.height,
    sourceSha256: sha256(original),
  };
}

async function main([cardId, originalPath, ...flags]) {
  if (!cardId || !originalPath || flags.some((flag) => flag !== "--upload"))
    throw new Error(
      "Usage: node scripts/card-image.mjs <card ID> <original> [--upload]",
    );
  const root = fileURLToPath(new URL("../../", import.meta.url));
  const recordsPath = join(root, "data/card-images.json");
  const records = JSON.parse(await readFile(recordsPath, "utf8"));
  const record = records.images.find((image) => image.cardId === cardId);
  if (!record)
    throw new Error(`Record the permission for ${cardId} in ${recordsPath}`);
  const image = await prepareCardImage(
    cardId,
    await readFile(resolve(originalPath)),
  );
  const outDir = join(root, "data/work/card-images");
  await mkdir(outDir, { recursive: true });
  const served = join(outDir, image.key);
  await writeFile(served, image.bytes);
  if (flags.includes("--upload"))
    execFileSync(
      "node_modules/.bin/wrangler",
      [
        "kv",
        "key",
        "put",
        "--binding",
        "CARD_IMAGES",
        "--remote",
        image.key,
        "--path",
        served,
      ],
      {
        stdio: "inherit",
        env: { ...process.env, WRANGLER_SEND_METRICS: "false" },
      },
    );
  Object.assign(record, {
    sourceSha256: image.sourceSha256,
    key: image.key,
    width: image.width,
    height: image.height,
  });
  await writeFile(recordsPath, JSON.stringify(records, null, 2) + "\n");
  console.log(
    `${image.key}: ${image.width}x${image.height}, ${image.bytes.byteLength} bytes${flags.includes("--upload") ? ", uploaded" : ""}`,
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
)
  await main(process.argv.slice(2));
