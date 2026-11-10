import { readdir, readFile, mkdir, writeFile } from "node:fs/promises";
import { gzipSync, brotliCompressSync, constants } from "node:zlib";
import { checkBudgets, linkedStylesheets } from "./size-budgets.mjs";
const fixture = process.argv.includes("--fixture");
const results = [];
const output = fixture ? "dist-fixture" : "dist";
for (const dir of [output, `${output}/assets`, `${output}/data`])
  for (const file of await readdir(dir)) {
    if (!/\.(m?js|css|html|json|geojson|woff2)$/.test(file)) continue;
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
// Mark the stylesheets each entry page links, for the entry budgets.
for (const page of ["index.html"]) {
  const linked = linkedStylesheets(
    await readFile(`${output}/${page}`, "utf8"),
  ).map((href) => output + href);
  for (const row of results)
    if (linked.includes(row.file)) (row.entries ??= []).push(page);
}
await mkdir("results", { recursive: true });
await writeFile("results/sizes.json", JSON.stringify(results, null, 2));
console.table(results);

if (process.argv.includes("--check")) console.table(checkBudgets(results));
