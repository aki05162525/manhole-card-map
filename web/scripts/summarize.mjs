import { readFile, writeFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
const read = async (p) => JSON.parse(await readFile(p, "utf8"));
const median = (a) => {
  const s = [...a].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};
const background = (url) =>
  /\/maps\/|\/fonts\/|\/sprites\/|gsi\.go\.jp\/xyz\//.test(url);
const cdp = await read("results/cdp.json"),
  lh = await read("results/lighthouse.json"),
  sizes = await read("results/sizes.json");
if (cdp.length !== 40 || lh.length !== 20)
  throw Error(`5回分が揃っていない: ${cdp.length}, ${lh.length}`);
const groups = [];
for (const source of ["cdp", "lighthouse"])
  for (const engine of ["a", "b"])
    for (const mode of source === "cdp" ? ["full", "split"] : ["full"])
      for (const cache of ["cold", "warm"]) {
        const rows = (source === "cdp" ? cdp : lh).filter(
          (x) =>
            x.engine === engine &&
            (source !== "cdp" || x.mode === mode) &&
            x.cache === cache,
        );
        if (
          rows.length !== 5 ||
          rows.some(
            (x) =>
              !x.metrics?.ready ||
              x.metrics.errors.length ||
              (!Array.isArray(x.errors) && x.errors) ||
              (Array.isArray(x.errors) && x.errors.length),
          )
        )
          throw Error("失敗または欠測がある");
        const values = rows.map((x) => ({
          run: x.run,
          readyMS: x.metrics.ready,
          tapMS: source === "cdp" ? x.tap : x.metrics.taps.at(-1),
          ...(source === "lighthouse"
            ? { lcpMS: x.lcp, score: x.score, offlineReady: x.offlineReady }
            : {
                backgroundRequests: x.resources.filter((r) => background(r.url))
                  .length,
                backgroundBytes: x.resources
                  .filter((r) => background(r.url))
                  .reduce((a, r) => a + r.bytes, 0),
                pmtilesRequests: x.resources.filter((r) =>
                  r.url.includes(".pmtiles"),
                ).length,
              }),
        }));
        if (values.some((v) => !Number.isFinite(v.tapMS) || v.tapMS <= 0))
          throw Error("タップ計測が欠けている");
        if (new Set(values.map((v) => v.run)).size !== 5)
          throw Error("測定回が重複している");
        groups.push({
          source,
          engine,
          mode,
          cache,
          readyMedianMS: median(values.map((v) => v.readyMS)),
          readyMaxMS: Math.max(...values.map((v) => v.readyMS)),
          tapMedianMS: median(values.map((v) => v.tapMS)),
          tapMaxMS: Math.max(...values.map((v) => v.tapMS)),
          values,
        });
      }
const frames = {};
const resultFiles = await readdir("results");
for (const engine of ["a", "b"]) {
  const runs = [];
  for (let run = 1; run <= 5; run++) {
    if (!resultFiles.includes(`frames-${engine}-${run}.json`)) continue;
    const gaps = await read(`results/frames-${engine}-${run}.json`);
    const trace = await read(`results/interaction-${engine}-${run}.trace.json`);
    const pids = new Set(
      trace.traceEvents
        .filter((e) => e.name === "process_name" && e.args.name === "Renderer")
        .map((e) => e.pid),
    );
    const states = {};
    for (const e of trace.traceEvents)
      if (e.name === "PipelineReporter" && e.ph === "b" && pids.has(e.pid)) {
        const state = e.args.frame_reporter?.state;
        if (state) states[state] = (states[state] || 0) + 1;
      }
    const active =
      (states.STATE_PRESENTED_ALL || 0) +
      (states.STATE_PRESENTED_PARTIAL || 0) +
      (states.STATE_DROPPED || 0);
    runs.push({
      run,
      states,
      droppedRatio: (states.STATE_DROPPED || 0) / active,
      rafCount: gaps.length,
      rafOver33MS: gaps.filter((v) => v > 33.4).length,
      rafMaxMS: Math.max(...gaps),
      rafMedianMS: median(gaps),
      traceSHA256: createHash("sha256")
        .update(
          await readFile(`results/interaction-${engine}-${run}.trace.json`),
        )
        .digest("hex"),
    });
  }
  frames[engine] = {
    completedRuns: runs.length,
    plannedRuns: 5,
    incompleteReason:
      runs.length < 5 ? "利用者の指示により追加計測を終了" : null,
    runs,
    droppedRatioMedian: median(runs.map((r) => r.droppedRatio)),
    rafOver33MSMedian: median(runs.map((r) => r.rafOver33MS)),
    rafMaxMSMedian: median(runs.map((r) => r.rafMaxMS)),
  };
}
const environment = await read("results/environment.json");
const summary = {
  functionalChecks: await read("results/functional.json"),
  offlineChecks: await Promise.all(
    ["a", "b"].map(async (engine) => ({
      engine,
      ...(await read(`results/offline-${engine}.json`)),
    })),
  ),
  gpu: {
    devices: environment.gpu.devices,
    renderer: environment.gpu.auxAttributes.glRenderer,
  },
  date: "2026-10-22",
  units: "bytes, ms",
  conditions: {
    chrome: "150.0.7871.46",
    cpuSlowdown: 4,
    cdp: { latencyMS: 150, downloadBPS: 200000, uploadBPS: 93750 },
    lighthouse: lh[0].settings,
  },
  groups,
  frames,
  sizes,
  dataManifest: await read("public/data/manifest.json"),
  pmtiles: {
    source: "https://build.protomaps.com/20261020.pmtiles",
    bbox: [122, 20, 154, 46],
    maxZoom: 15,
    bytes: 3737849910,
    sha256: "ffe53b1be0ee26a2289f02c5bc4619959afd6e5cc203e29a5a7e1fe0e0f26797",
  },
};
await writeFile(
  "../docs/verification/06-results.json",
  JSON.stringify(summary, null, 2) + "\n",
);
console.table(
  groups.map(({ source, engine, mode, cache, readyMedianMS, tapMedianMS }) => ({
    source,
    engine,
    mode,
    cache,
    readyMedianMS,
    tapMedianMS,
  })),
);
console.log(frames);
