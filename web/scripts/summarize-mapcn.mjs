// Run immediately after measurement, before rebuilding dist.
import { readFile, readdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const source = process.env.RESULTS_DIR || "results/mapcn";
const rows = JSON.parse(await readFile(`${source}/cdp.json`, "utf8"));
const frames = JSON.parse(
  await readFile(`${source}/frames-mapcn-1.json`, "utf8"),
);
const percentile = (values, fraction) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)] ?? null;
};
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const build = {};
for (const file of [
  "index.html",
  "maplibre-gl-worker.mjs",
  "maplibre-gl-shared.mjs",
  ...(await readdir("dist/assets"))
    .filter((f) => !/\.(br|gz)$/.test(f))
    .map((f) => `assets/${f}`),
]) {
  build[file] = sha(await readFile(`dist/${file}`));
}
const data = JSON.parse(await readFile("dist/data/full.json", "utf8"));
const result = {
  measuredAt: new Date(rows[0].origin).toISOString(),
  scope:
    "Real card data + live CARTO background; PC headless simulation, not phone acceptance",
  environment: {
    userAgent: rows[0].ua,
    viewport: [412, 823],
    deviceScaleFactor: 1.75,
    cpuSlowdown: 4,
    latencyMs: 150,
    downloadBitsPerSecond: 1600000,
    uploadBitsPerSecond: 750000,
    gpu: "headless Chromium with --enable-unsafe-swiftshader; no physical phone measurement",
  },
  data: {
    cards: data.cards.length,
    pins: data.pins.length,
    sha256: sha(await readFile("dist/data/full.json")),
  },
  runs: rows.map((r) => ({
    run: r.run,
    cache: r.cache,
    startupMs: r.metrics.ready,
    selectionMs: r.tap,
    errors: [...r.metrics.errors, ...r.errors],
    stages: r.stages,
    startupTransferredBytes: r.resources.reduce(
      (sum, resource) => sum + resource.bytes,
      0,
    ),
  })),
  summary: Object.fromEntries(
    ["cold", "warm"].map((cache) => {
      const selected = rows.filter((r) => r.cache === cache);
      return [
        cache,
        {
          runs: selected.length,
          medianStartupMs: percentile(
            selected.map((r) => r.metrics.ready),
            0.5,
          ),
          medianSelectionMs: percentile(
            selected.map((r) => r.tap).filter(Number.isFinite),
            0.5,
          ),
        },
      ];
    }),
  ),
  interaction: {
    runs: 1,
    samples: frames.length,
    medianRafGapMs: percentile(frames, 0.5),
    p95RafGapMs: percentile(frames, 0.95),
    gapsOver50ms: frames.filter((f) => f > 50).length,
    caveat:
      "rAF intervals over scripted pan/zoom including pauses, not measured rendered FPS or physical touch smoothness",
  },
  buildSHA256: build,
  notes: [
    "Selection measures final click to list/detail paint after cluster drilldown, not whole navigation time.",
    "SW saves all application chunks after map ready, including comparison chunks; this network work can overlap first interaction.",
    "Live provider tiles/cache/content may change between runs; do not directly compare historical backgrounds as a controlled renderer benchmark.",
    "Follow-up cleanup guard and panel positioning can change final build hashes; these hashes identify only the measured build.",
  ],
};
await writeFile(
  "../docs/verification/08-results.json",
  JSON.stringify(result, null, 2) + "\n",
);
console.log(
  JSON.stringify({ summary: result.summary, interaction: result.interaction }),
);
