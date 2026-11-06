import { readdir, readFile, mkdir, writeFile } from "node:fs/promises";
import { gzipSync, brotliCompressSync, constants } from "node:zlib";
const results = [];
for (const dir of ["dist/assets", "public/data"])
  for (const file of await readdir(dir)) {
    if (!/\.(js|css|json|geojson)$/.test(file)) continue;
    const b = await readFile(`${dir}/${file}`);
    results.push({
      file: `${dir}/${file}`,
      raw: b.length,
      gzip: gzipSync(b, { level: 9 }).length,
      brotli: brotliCompressSync(b, {
        params: { [constants.BROTLI_PARAM_QUALITY]: 11 },
      }).length,
    });
  }
await mkdir("results", { recursive: true });
await writeFile("results/sizes.json", JSON.stringify(results, null, 2));
console.table(results);
