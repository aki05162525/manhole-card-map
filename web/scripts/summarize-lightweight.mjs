import { readFile, writeFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
const directory = process.env.RESULTS_DIR || "results/lightweight-final";
const read = async (name) =>
  JSON.parse(await readFile(`${directory}/${name}`, "utf8"));
const cdp = await read("cdp.json"),
  lighthouse = await read("lighthouse.json");
const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const groups = [];
for (const [source, rows, engines] of [
  ["Chrome", cdp, ["a", "c", "d"]],
  ["Lighthouse", lighthouse, ["c"]],
]) {
  for (const engine of engines)
    for (const cache of ["cold", "warm"]) {
      const selected = rows.filter(
        (row) =>
          row.engine === engine &&
          row.cache === cache &&
          (row.mode ?? "full") === "full",
      );
      if (
        selected.length !== 5 ||
        new Set(selected.map((row) => row.run)).size !== 5
      )
        throw Error(
          `${source}/${engine}/${cache}: expected five distinct runs`,
        );
      const values = selected.map((row) => ({
        run: row.run,
        readyMS: row.metrics.ready,
        tapMS: source === "Chrome" ? row.tap : row.metrics.taps.at(-1),
        errors: [
          ...(row.metrics.errors || []),
          ...(Array.isArray(row.errors)
            ? row.errors
            : row.errors
              ? [row.errors]
              : []),
        ],
        ...(row.stages ? { stages: row.stages } : {}),
      }));
      if (
        values.some(
          (row) =>
            !Number.isFinite(row.readyMS) ||
            row.readyMS <= 0 ||
            !Number.isFinite(row.tapMS),
        )
      )
        throw Error(`${source}/${engine}/${cache}: incomplete observations`);
      groups.push({
        source,
        engine,
        cache,
        values,
        readyMedianMS: median(values.map((row) => row.readyMS)),
        readyMaxMS: Math.max(...values.map((row) => row.readyMS)),
        tapMedianMS: median(values.map((row) => row.tapMS)),
        tapMaxMS: Math.max(...values.map((row) => row.tapMS)),
      });
    }
}
const buildFiles = [
  "index.html",
  ...(await readdir("dist/assets")).map((name) => `assets/${name}`),
];
const buildSHA256 = {};
for (const file of buildFiles)
  buildSHA256[file] = createHash("sha256")
    .update(await readFile(`dist/${file}`))
    .digest("hex");
const report = {
  date: "2026-11-05",
  units: "milliseconds",
  kind: "local prototype measurements, not Android acceptance",
  conditions: {
    data: "1313 cards, 1309 confirmed lid pins; no distribution-place pins",
    viewport: "412x823, DPR 1.75, no location, national initial extent",
    browser: cdp[0].ua,
    chrome: {
      cpuSlowdownMultiplier: 4,
      latencyMS: 150,
      downBPS: 200000,
      upBPS: 93750,
    },
    lighthouse: lighthouse[0].settings.throttling,
    cold: "new browser/context without HTTP cache or SW",
    warm: "same context after SW ready",
    startup:
      "full card details, background, pins and handlers ready, then two RAF callbacks",
    tap: "first visible non-clustered pin; target card not fixed across engines; event timestamp through detail and paint opportunity",
    offline: "app/cards only; background is not stored by SW",
    hardware: "WSL2 desktop Chrome headless, not an Android device",
    motion: "common zoom 7/8; each engine only one motion sample",
  },
  targets: { coldStartupMS: 3000, warmStartupMS: 1000, tapMS: 100 },
  groups,
  buildSHA256,
  background: JSON.parse(
    await readFile("public/background/manifest.json", "utf8"),
  ),
  dataManifest: JSON.parse(await readFile("public/data/manifest.json", "utf8")),
  acceptance: {
    accepted: false,
    reasons: [
      "C cold startup exceeds 3 seconds in both measurements",
      "C tap latency exceeds 100 ms",
      "Android measurements not performed",
      "Distribution-place pin performance not measured with real confirmed data",
    ],
  },
};
await writeFile(
  "../docs/verification/07-results.json",
  JSON.stringify(report, null, 2) + "\n",
);
for (const g of groups)
  console.log(
    g.source,
    g.engine,
    g.cache,
    g.readyMedianMS.toFixed(1),
    g.tapMedianMS.toFixed(1),
  );
