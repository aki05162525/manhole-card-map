import { readFile, writeFile } from "node:fs/promises";
const median = (values) => {
  const sorted = values.toSorted((a, b) => a - b);
  return (
    (sorted[Math.floor((sorted.length - 1) / 2)] +
      sorted[Math.floor(sorted.length / 2)]) /
    2
  );
};
// Use thread CPU clocks: background parser wall time includes waiting for bytes.
function unionDuration(events) {
  const threads = new Map();
  for (const event of events) {
    const key = `${event.pid}/${event.tid}`;
    if (!threads.has(key)) threads.set(key, []);
    if (Number.isFinite(event.tts) && Number.isFinite(event.tdur))
      threads.get(key).push([event.tts, event.tts + event.tdur]);
  }
  let total = 0;
  for (const ranges of threads.values()) {
    let end = -Infinity;
    for (const [start, stop] of ranges.sort((a, b) => a[0] - b[0])) {
      total += Math.max(0, stop - Math.max(start, end));
      end = Math.max(end, stop);
    }
  }
  return total / 1000;
}
function loaded(row, name) {
  const measure = row.final.measures.find((e) => e.name === name);
  return measure && measure.startTime + measure.duration;
}
function category(row) {
  const url = new URL(row.url);
  if (url.protocol === "data:") return "inline";
  if (url.pathname.includes("maplibre-gl-worker")) return "worker";
  if (url.pathname.endsWith(".mvt")) return "tiles";
  if (
    !url.hostname.includes("127.0.0.1") &&
    !url.hostname.includes("manhole-techo.com")
  )
    return "basemap-or-third-party";
  if (row.type === "Font") return "fonts";
  if (/^\/data(?:-v)?\//.test(url.pathname)) return "data";
  if (url.pathname.endsWith(".js")) return "js";
  if (url.pathname.endsWith(".css")) return "css";
  if (row.type === "Document") return "html";
  return "other";
}
for (const label of process.argv.slice(2)) {
  const directory = `results/map-performance/${label}`;
  const data = JSON.parse(await readFile(`${directory}/samples.json`, "utf8"));
  const samples = [];
  for (const row of data.rows) {
    const trace = JSON.parse(
      await readFile(`${directory}/${row.run}-${row.cache}.trace.json`, "utf8"),
    ).traceEvents;
    const ready = trace.find((e) => e.name === "map-ready");
    const start = ready.ts - row.startup.metrics.ready * 1000;
    const compile = trace.filter(
      (e) =>
        e.ph === "X" &&
        e.ts >= start &&
        e.ts < ready.ts &&
        /^(v8\.compileModule|v8\.parseOnBackground|v8\.parseOnBackgroundParsing)$/.test(
          e.name,
        ),
    );
    const metrics = Object.fromEntries(row.cpu.map((e) => [e.name, e.value]));
    const bytes = {};
    const missingTransfers = [];
    for (const r of row.startupResources) {
      const group = category(r);
      if (!r.end && !r.cached && !r.url.startsWith("data:"))
        missingTransfers.push(r.url);
      bytes[group] = (bytes[group] || 0) + r.transfer;
    }
    const gaps = row.movement.gaps;
    const badge = row.taps.slice(0, -1);
    const interactions = row.final.events.filter((e) => e.interactionId > 0);
    const inWindow = (time, a, b) => time >= a && time <= b;
    samples.push({
      run: row.run,
      cache: row.cache,
      ready: row.startup.metrics.ready,
      search: row.startup.search,
      lcp: row.startup.lcp,
      // Arrival times; the details may come after map-ready.
      pins: loaded(row, "pins-load"),
      data: loaded(row, "data-load"),
      pinDetail: row.final.metrics.taps.at(-1),
      script: metrics.ScriptDuration * 1000,
      compile: unionDuration(compile),
      workerScriptCpu: unionDuration(
        trace.filter(
          (e) =>
            e.ph === "X" &&
            e.name === "FunctionCall" &&
            e.ts >= start &&
            e.ts < ready.ts &&
            /maplibre-gl-worker/.test(e.args?.data?.url || ""),
        ),
      ),
      missingTransferCount: missingTransfers.length,
      // Lab blocking window, FCP to existing map-ready; not Lighthouse TTI.
      tbt: row.startup.longTasks.reduce(
        (total, e) =>
          total +
          Math.max(
            0,
            Math.min(e.start + e.duration, row.startup.metrics.ready) -
              Math.max(e.start, row.startup.fcp) -
              50,
          ),
        0,
      ),
      longTasks: row.startup.longTasks.filter(
        (e) => e.start < row.startup.metrics.ready,
      ).length,
      interactionMax: Math.max(0, ...interactions.map((e) => e.duration)),
      badgeEventMax: Math.max(
        0,
        ...interactions
          .filter((e) =>
            badge.some((t) => inWindow(e.startTime, t.before.now, t.after.now)),
          )
          .map((e) => e.duration),
      ),
      badgeCamera: Math.max(
        0,
        ...badge.map((t) =>
          t.camera ? t.camera.lastChange - t.camera.now : 0,
        ),
      ),
      movementLateFrames: gaps.filter((g) => g > 25).length,
      movementMissingFrames: gaps.reduce(
        (n, g) => n + Math.max(0, Math.round(g / (1000 / 60)) - 1),
        0,
      ),
      movementFrames: gaps.length,
      movementDroppedReports: trace.filter(
        (e) =>
          e.name === "Scheduler::BeginFrameDropped" &&
          inWindow((e.ts - start) / 1000, row.movement.start, row.movement.end),
      ).length,
      bytes,
    });
  }
  const medians = [];
  for (const cache of ["cold", "warm"]) {
    const group = samples.filter((row) => row.cache === cache),
      result = { cache, count: group.length };
    for (const key of Object.keys(group[0]).filter(
      (k) => !["run", "cache", "bytes"].includes(k),
    ))
      result[key] = Math.round(median(group.map((r) => r[key])));
    result.bytes = Object.fromEntries(
      [...new Set(group.flatMap((r) => Object.keys(r.bytes)))].map((k) => [
        k,
        median(group.map((r) => r.bytes[k] || 0)),
      ]),
    );
    medians.push(result);
  }
  await writeFile(
    `${directory}/summary.json`,
    JSON.stringify({ conditions: data.conditions, medians, samples }, null, 2),
  );
  console.log(label);
  console.table(
    medians.map(({ bytes, ...r }) => ({
      ...r,
      transfer: Object.values(bytes).reduce((a, b) => a + b, 0),
    })),
  );
  console.log(
    JSON.stringify(medians.map((r) => ({ cache: r.cache, bytes: r.bytes }))),
  );
}
