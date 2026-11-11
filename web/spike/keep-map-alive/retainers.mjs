// SPIKE(keep-map-alive): after a few round trips, find what retains detached
// catalog DOM. ORIGIN=http://127.0.0.1:4291 node spike/keep-map-alive/retainers.mjs
import { chromium } from "playwright";

const origin = process.env.ORIGIN;
const trips = Number(process.env.TRIPS || 4);
const browser = await chromium.launch({
  args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
});
const context = await browser.newContext({
  viewport: { width: 412, height: 915 },
  isMobile: true,
  hasTouch: true,
});
const page = await context.newPage();
const cdp = await context.newCDPSession(page);
await page.goto(`${origin}/`);
await page.waitForFunction(() => window.prototype?.metrics?.ready > 0);
await page.waitForTimeout(2000);
for (let i = 0; i < trips; i++) {
  await page.click(".map-search-bar .site-menu-button");
  await page.click('.map-search-bar .site-menu-panel a[href^="/cards"]');
  await page
    .locator("#cards-root .catalog-regions button[data-pref]")
    .first()
    .waitFor();
  await page.waitForTimeout(300);
  if (process.env.VIA_LINK) {
    await page.click(".site-header .site-menu-button");
    await page.click('.site-header .site-menu-panel a[href="/"]');
  } else await page.goBack();
  await page.waitForFunction(() => !document.getElementById("cards-root"));
  await page.waitForTimeout(300);
}
await cdp.send("HeapProfiler.enable");
await cdp.send("HeapProfiler.collectGarbage");
const chunks = [];
cdp.on("HeapProfiler.addHeapSnapshotChunk", ({ chunk }) => chunks.push(chunk));
await cdp.send("HeapProfiler.takeHeapSnapshot", { reportProgress: false });
const snap = JSON.parse(chunks.join(""));
await browser.close();

const m = snap.snapshot.meta;
const nf = m.node_fields.length;
const ef = m.edge_fields.length;
const nTypes = m.node_types[0];
const eTypes = m.edge_types[0];
const nodes = snap.nodes;
const edges = snap.edges;
const strings = snap.strings;
const count = nodes.length / nf;
const firstEdge = new Uint32Array(count + 1);
for (let i = 0, e = 0; i < count; i++) {
  firstEdge[i] = e;
  e += nodes[i * nf + m.node_fields.indexOf("edge_count")] * ef;
}
firstEdge[count] = edges.length;
const nameOf = (i) => strings[nodes[i * nf + m.node_fields.indexOf("name")]];
const typeOf = (i) => nTypes[nodes[i * nf + m.node_fields.indexOf("type")]];
// Reverse edges.
const retainers = Array.from({ length: count }, () => []);
for (let i = 0; i < count; i++) {
  for (let e = firstEdge[i]; e < firstEdge[i + 1]; e += ef) {
    const to = edges[e + m.edge_fields.indexOf("to_node")] / nf;
    const type = eTypes[edges[e + m.edge_fields.indexOf("type")]];
    if (type === "weak") continue;
    const nameOrIndex = edges[e + m.edge_fields.indexOf("name_or_index")];
    const edgeName =
      type === "element" || type === "hidden"
        ? `[${nameOrIndex}]`
        : strings[nameOrIndex];
    retainers[to].push({ from: i, edgeName, type });
  }
}
const detached = [];
for (let i = 0; i < count; i++) {
  if (
    m.node_fields.includes("detachedness") &&
    nodes[i * nf + m.node_fields.indexOf("detachedness")] === 2 &&
    typeOf(i) === "native"
  )
    detached.push(i);
}
const byName = {};
for (const i of detached) byName[nameOf(i)] = (byName[nameOf(i)] || 0) + 1;
console.log("fields", m.node_fields.join(","));
console.log("detached total", detached.length);
console.log(
  Object.entries(byName)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12),
);
// Shortest path from a detached cards-page node to a non-detached root.
const target =
  detached.find((i) => /cards-page/.test(nameOf(i))) ??
  detached.find((i) => /cards-root/.test(nameOf(i))) ??
  detached[0];
if (target !== undefined) {
  console.log("target", nameOf(target));
  for (let path = 0; path < 4; path++) {
    const seen = new Set([target]);
    let frontier = [[target, []]];
    let found = null;
    const banned = globalThis.__banned ?? (globalThis.__banned = new Set());
    while (frontier.length && !found) {
      const next = [];
      for (const [node, trail] of frontier) {
        for (const r of retainers[node]) {
          if (seen.has(r.from) || banned.has(r.from)) continue;
          seen.add(r.from);
          const t = [
            ...trail,
            `${typeOf(r.from)}:${nameOf(r.from).slice(0, 60)} --${r.edgeName}-->`,
          ];
          const n = nameOf(r.from);
          if (
            typeOf(r.from) === "synthetic" ||
            /^Window|^system \/ NativeContext|^HTMLDocument/.test(n)
          ) {
            found = t;
            break;
          }
          next.push([r.from, t]);
        }
        if (found) break;
      }
      frontier = next;
    }
    if (!found) break;
    console.log(
      `path ${path + 1}:\n  ` + found.slice(-14).reverse().join("\n  "),
    );
    // Ban the node just below the root to find a different path.
    const nodeBelow = found.length >= 2 ? found.length - 2 : 0;
    void nodeBelow;
    break;
  }
}
