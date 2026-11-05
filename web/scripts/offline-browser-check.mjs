// Same-origin, real Chromium/SW regression; never reads or writes dist/public.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { chromium } from "playwright";
import { generateServiceWorker } from "./sw-generator.mjs";

const web = dirname(dirname(fileURLToPath(import.meta.url)));
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const legacyRef =
  process.env.OFFLINE_BASELINE_REF ||
  "cebbcbc42d6d2cf51a8fb6f47616bb5b58824fd8";
const git = (...args) =>
  execFileSync("git", args, { cwd: web, encoding: "utf8" }).trim();
const legacySource = git("show", `${legacyRef}:web/scripts/prepare.mjs`);
// Evaluate only the original generated template, never prepare/build itself.
const legacyTemplate = legacySource.match(/`const CACHE=[\s\S]*?\n`(?=,)/)?.[0];
assert.ok(
  legacyTemplate,
  `${legacyRef}: original SW template not found (no silent fallback)`,
);
const legacyWorker = (version, manifest) =>
  vm.runInNewContext(legacyTemplate, {
    version,
    files: Object.keys(manifest),
    JSON,
  });
const temporary = await mkdtemp(join(tmpdir(), "manhole-offline-browser-"));
let context;
let deployment;
let fault;
let gate;
let releaseGate;
let offline = false;
const requests = [];
const pageErrors = [];
const server = createServer(async (req, res) => {
  const path = new URL(req.url, "http://localhost").pathname;
  requests.push({ path, version: deployment?.version, offline });
  if (offline) {
    res.writeHead(503).end("offline test");
    return;
  }
  const snapshot = deployment;
  if (gate?.path === path) {
    gate.seen = true;
    gate.markSeen();
    await gate.promise;
  }
  if (res.destroyed) return;
  if (fault?.path === path && fault.kind === "http") {
    res.writeHead(503).end("injected HTTP failure");
    return;
  }
  const bytes =
    path === "/sw.js"
      ? snapshot.worker
      : snapshot.files[path === "/" ? "/index.html" : path];
  if (bytes === undefined) {
    res.writeHead(404).end();
    return;
  }
  res.writeHead(200, {
    "Content-Type": path.endsWith(".js")
      ? "text/javascript"
      : path.endsWith(".json")
        ? "application/json"
        : "text/html; charset=utf-8",
    "Cache-Control": "no-cache",
  });
  res.end(
    fault?.path === path && fault.kind === "hash" ? `${bytes}\ncorrupt` : bytes,
  );
});
const stored = {
  "map-view": JSON.stringify({ lat: 35.46, lng: 139.62, zoom: 13 }),
  "issue8-collected": JSON.stringify(["TEST-A001"]),
  "issue8-filter": "suspended",
};

async function launch(profile) {
  context = await chromium.launchPersistentContext(join(temporary, profile), {
    headless: true,
  });
  context.setDefaultTimeout(15000);
  context.on("page", (page) =>
    page.on("pageerror", (error) => pageErrors.push(String(error))),
  );
  return context;
}
async function wait(page, fn, argument) {
  await page.waitForFunction(fn, argument, { timeout: 15000 });
}
async function status(page) {
  return page.evaluate(() =>
    window.readStatus(navigator.serviceWorker.controller),
  );
}
async function storage(page) {
  assert.deepEqual(
    await page.evaluate(() => Object.fromEntries(Object.entries(localStorage))),
    stored,
  );
}
async function consistent(page, site, { document = true } = {}) {
  if (document) {
    assert.equal(
      await page.locator("body").getAttribute("data-version"),
      site.label,
    );
    assert.equal(await page.evaluate(() => window.assetVersion), site.label);
  }
  // Exact bytes/hashes, not only a marker: full, both split files, manifest, HTML and JS.
  const hashes = await page.evaluate(
    async (paths) =>
      Object.fromEntries(
        await Promise.all(
          paths.map(async (path) => {
            const response = await fetch(path);
            if (!response.ok) throw Error(`${path}: HTTP ${response.status}`);
            const bytes = await response.arrayBuffer();
            const hash = [
              ...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
            ]
              .map((b) => b.toString(16).padStart(2, "0"))
              .join("");
            return [path, hash];
          }),
        ),
      ),
    Object.keys(site.manifest),
  );
  assert.deepEqual(
    hashes,
    site.manifest,
    `${site.label}: all stable URLs must belong to the document generation`,
  );
  const saved = await status(page);
  assert.equal(saved.version, site.version);
  assert.equal(saved.ready, true);
  await storage(page);
}
async function openInitial(origin, site, profile) {
  deployment = site;
  fault = undefined;
  offline = false;
  await launch(profile);
  const page = await context.newPage();
  await page.goto(origin);
  await page.evaluate((values) => {
    for (const [k, v] of Object.entries(values)) localStorage.setItem(k, v);
  }, stored);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await wait(
    page,
    () => !!navigator.serviceWorker.controller && !!window.readStatus,
  );
  await consistent(page, site);
  const second = await context.newPage();
  await second.goto(`${origin}/legacy.html`);
  await wait(second, () => !!window.readStatus);
  await consistent(second, site);
  return [page, second];
}
async function beginUpdate(page, next, injected) {
  deployment = next;
  fault = injected;
  await page.evaluate(async () => {
    window.installResult = "pending";
    const reg = await navigator.serviceWorker.getRegistration();
    const track = () => {
      const worker = reg.installing;
      if (!worker) return;
      const observe = () => {
        if (["installed", "activated", "redundant"].includes(worker.state))
          window.installResult = worker.state;
      };
      worker.addEventListener("statechange", observe);
      observe();
    };
    reg.addEventListener("updatefound", track, { once: true });
    await reg.update();
    track();
  });
}
async function clickUpdate(page, site) {
  await page
    .getByRole("button", { name: "更新して再読み込み", exact: true })
    .click();
  await wait(
    page,
    (label) => document.body.dataset.version === label && !!window.readStatus,
    site.label,
  );
  await consistent(page, site);
}
async function stopContext() {
  await context?.close();
  context = undefined;
}

try {
  // Bun bundles the real client module; the fixture only renders its state/action.
  const entry = join(temporary, "client.ts");
  await writeFile(
    entry,
    `import {startOfflineUpdates,workerStatus} from ${JSON.stringify(join(web, "src/offline-update.ts"))};
window.readStatus=workerStatus;
if(document.body.hasAttribute('data-old')) navigator.serviceWorker.register('/sw.js'); else startOfflineUpdates(state=>{document.querySelector('#state').textContent=state.text; const button=document.querySelector('button');button.hidden=!state.action;button.textContent=state.actionLabel||'';button.onclick=state.action||null;});`,
  );
  execFileSync(
    "bun",
    [
      "build",
      entry,
      "--target=browser",
      "--minify",
      "--outfile",
      join(temporary, "client.js"),
    ],
    { cwd: web, stdio: "pipe" },
  );
  const client = await readFile(join(temporary, "client.js"), "utf8");
  function site(label, generator = generateServiceWorker) {
    const data = {
      schema: "issue8-synthetic",
      updated: label,
      cards: [{ id: `TEST-${label}`, name: `Synthetic ${label}` }],
      pins: [{ id: `pin-${label}`, lat: 35, lng: 139 }],
    };
    const json = (value) => JSON.stringify(value) + "\n";
    const html = `<!doctype html><html lang="ja"><meta charset="utf-8"><title>Issue8 ${label}</title><body data-version="${label}" ${generator === legacyWorker ? "data-old" : ""}><p id="state"></p><button hidden></button><script src="/assets/app.js"></script></body></html>`;
    const files = {
      "/index.html": html,
      "/legacy.html": html.replace("<title>", "<title>Legacy "),
      "/assets/app.js": `window.assetVersion=${JSON.stringify(label)};\n${client}`,
      "/data/full.json": json(data),
      "/data/details.json": json({ ...data, pins: null }),
    };
    files["/data/pins.json"] = json({
      schema: data.schema,
      updated: label,
      pins: data.pins,
      detailsSHA256: sha(files["/data/details.json"]),
    });
    files["/data/manifest.json"] = json({
      updated: label,
      files: Object.fromEntries(
        Object.entries(files)
          .filter(([path]) => path.startsWith("/data/"))
          .map(([path, bytes]) => [path.slice(6), sha(bytes)]),
      ),
    });
    const manifest = Object.fromEntries(
      Object.entries(files).map(([path, bytes]) => [path, sha(bytes)]),
    );
    const version = `prototype-issue8-${label}-${sha(Object.values(files).join("")).slice(0, 16)}`;
    return {
      label,
      files,
      manifest,
      version,
      worker: generator(version, manifest),
    };
  }
  const A = site("A"),
    B = site("B"),
    C = site("C"),
    D = site("D");
  const oldA = site("oldA", legacyWorker),
    oldB = site("oldB", legacyWorker);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  console.log(
    JSON.stringify({
      node: process.version,
      baseline: git("rev-parse", legacyRef),
      head: git("rev-parse", "HEAD"),
      generatorSHA256: sha(
        await readFile(join(web, "scripts/sw-generator.mjs")),
      ),
      clientSHA256: sha(await readFile(join(web, "src/offline-update.ts"))),
      versions: [A, B, C, D, oldA, oldB].map((s) => s.version),
    }),
  );

  let [page, second] = await openInitial(origin, A, "modern");
  console.log(`Chromium ${context.browser().version()}`);
  let markSeen;
  const reached = new Promise((resolve) => {
    markSeen = resolve;
  });
  gate = {
    path: "/data/manifest.json",
    seen: false,
    markSeen,
    promise: new Promise((resolve) => {
      releaseGate = resolve;
    }),
  };
  await beginUpdate(page, B);
  // Browser polling plus a Node deadline makes the gate independent of timing sleeps.
  const deadline = setTimeout(() => gate?.markSeen(), 15000);
  try {
    await reached;
  } finally {
    clearTimeout(deadline);
  }
  assert.equal(
    gate.seen,
    true,
    "B installer must reach held response before deadline",
  );
  await wait(page, () => window.installResult === "pending");
  await consistent(page, A);
  await consistent(second, A);
  assert.equal(gate.seen, true, "B install must reach the held final file");
  releaseGate();
  gate = undefined;
  await wait(page, () => window.installResult === "installed");
  await consistent(page, A);
  await consistent(second, A);
  // Normal reload while B waits must remain coherent and offer an update action.
  await page.reload();
  await consistent(page, A);
  await clickUpdate(page, B);
  await consistent(second, A);
  await second.reload();
  await consistent(second, B);
  console.log(
    "PASS A -> B: held install, waiting/reload, real update button, two tabs, full/split/assets/HTML and storage",
  );

  for (const [kind, next] of [
    ["hash", C],
    ["http", D],
  ]) {
    await beginUpdate(page, next, { kind, path: "/data/pins.json" });
    await wait(page, () => window.installResult === "redundant");
    assert.ok(
      requests.some(
        (r) => r.version === next.version && r.path === "/data/pins.json",
      ),
    );
    assert.equal(
      await page.evaluate((version) => caches.has(version), next.version),
      false,
      "failed partial generation removed",
    );
    await consistent(page, B);
    await consistent(second, B);
    await page
      .locator("#state")
      .filter({ hasText: "新版を保存できませんでした" })
      .waitFor();
    offline = true;
    await context.setOffline(true);
    await page.reload();
    await consistent(page, B);
    offline = false;
    await context.setOffline(false);
    console.log(
      `PASS ${kind} install failure: rejected, partial cache removed, B usable offline, storage unchanged`,
    );
  }
  // Close the entire Chromium profile and reopen it, not merely a page reload.
  await stopContext();
  offline = true;
  await launch("modern");
  await context.setOffline(true);
  page = await context.newPage();
  await page.goto(origin);
  await consistent(page, B);
  second = await context.newPage();
  await second.goto(`${origin}/legacy.html`);
  await consistent(second, B);
  console.log(
    "PASS offline browser restart: both entrypoints, full/split, assets, persisted storage",
  );
  await stopContext();

  // Negative control: original skipWaiting + claim changes data underneath old HTML/JS.
  [page, second] = await openInitial(origin, oldA, "baseline");
  await beginUpdate(page, oldB);
  await wait(
    page,
    async (version) => {
      const result = await window.readStatus(
        navigator.serviceWorker.controller,
      );
      return result.version === version;
    },
    oldB.version,
  );
  assert.equal(
    await page.locator("body").getAttribute("data-version"),
    oldA.label,
  );
  assert.equal(await page.evaluate(() => window.assetVersion), oldA.label);
  await wait(page, () => window.installResult === "activated");
  await consistent(page, oldB, { document: false });
  assert.equal(
    await page.evaluate((version) => caches.has(version), oldA.version),
    false,
  );
  console.log(
    "PASS negative control reproduced: fixed-baseline old HTML/JS + new stable-URL data; old cache deleted",
  );
  await stopContext();

  [page, second] = await openInitial(origin, oldA, "migration");
  await beginUpdate(page, oldB, { kind: "http", path: "/data/pins.json" });
  await wait(page, () => window.installResult === "redundant");
  assert.equal(await page.evaluate((v) => caches.has(v), oldB.version), true);
  await beginUpdate(page, B);
  await wait(page, () => window.installResult === "activated");
  console.log(
    "migration diagnostics",
    JSON.stringify(
      await page.evaluate(async () => ({
        status: await window.readStatus(navigator.serviceWorker.controller),
        caches: await caches.keys(),
        metadata: await Promise.all(
          (await (await caches.open("manhole-offline-protocol-v1")).keys()).map(
            async (req) => [
              req.url,
              await (
                await (
                  await caches.open("manhole-offline-protocol-v1")
                ).match(req)
              ).text(),
            ],
          ),
        ),
      })),
    ),
  );
  await consistent(page, oldA);
  await consistent(second, oldA);
  await page.reload();
  await consistent(page, B);
  await consistent(second, oldA);
  assert.equal(
    await page.evaluate((version) => caches.has(version), oldA.version),
    true,
  );
  await second.reload();
  await consistent(second, B);
  console.log(
    "PASS fixed-baseline worker -> current worker migration: old tab/cache survives until navigation",
  );
  await stopContext();

  assert.deepEqual(pageErrors, [], "no uncaught page runtime exceptions");
  console.log(
    "PASS all offline browser regression checks (synthetic data; no real-data UI claim)",
  );
} finally {
  // Release any held response before closing sockets, including assertion failures.
  releaseGate?.();
  gate = undefined;
  await stopContext();
  server.closeAllConnections();
  await new Promise((resolve, reject) =>
    server.close((error) =>
      error && error.code !== "ERR_SERVER_NOT_RUNNING"
        ? reject(error)
        : resolve(),
    ),
  );
  await rm(temporary, { recursive: true, force: true });
}
