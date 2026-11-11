// SPIKE(keep-map-alive): throwaway measurement. Not part of the app or CI.
// ORIGIN=http://127.0.0.1:4291 node spike/keep-map-alive/measure.mjs <base|spike|soak|hidden|direct|css> <label>
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";

const origin = process.env.ORIGIN;
const mode = process.argv[2];
const label = process.argv[3] || mode;
const runs = Number(process.env.RUNS || 8);
const out = `results/spike-keep-map-alive/${label}`;
await mkdir(out, { recursive: true });
const throttle = process.env.NO_THROTTLE !== "1";

const browser = await chromium.launch({
  args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
});

function initScript() {
  addEventListener(
    "click",
    (e) => {
      const a = e.target.closest?.("a");
      if (a)
        sessionStorage.setItem(
          "spikeClickAbs",
          String(performance.timeOrigin + e.timeStamp),
        );
    },
    true,
  );
  window.__afterPaint = () =>
    new Promise((r) =>
      requestAnimationFrame(() => setTimeout(() => r(performance.now()))),
    );
  window.__waitVisible = (sel) =>
    new Promise((res) => {
      const tick = () => {
        const el = document.querySelector(sel);
        if (el && el.getClientRects().length) window.__afterPaint().then(res);
        else requestAnimationFrame(tick);
      };
      tick();
    });
  if (location.pathname === "/cards")
    window
      .__waitVisible(".catalog-regions button[data-pref]")
      .then((t) => (window.__listShownAt = t));
  const getContext = HTMLCanvasElement.prototype.getContext;
  const seen = new WeakSet();
  window.__webgl = 0;
  HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
    const ctx = getContext.call(this, type, ...rest);
    if (ctx && /webgl/.test(type) && !seen.has(ctx)) {
      seen.add(ctx);
      window.__webgl++;
    }
    return ctx;
  };
  const NativeWorker = window.Worker;
  window.__workersCreated = 0;
  window.__workersTerminated = 0;
  window.Worker = class extends NativeWorker {
    constructor(...args) {
      super(...args);
      window.__workersCreated++;
    }
    terminate() {
      window.__workersTerminated++;
      return super.terminate();
    }
  };
}

async function newPage() {
  const context = await browser.newContext({
    viewport: { width: 412, height: 915 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 1.75,
  });
  await context.addInitScript(initScript);
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Performance.enable");
  if (throttle) {
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    await cdp.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: 150,
      downloadThroughput: 200000,
      uploadThroughput: 93750,
      connectionType: "cellular4g",
    });
  }
  const requests = [];
  const workers = new Set();
  let nextId = 1;
  function workerCommand(sessionId, method, params = {}) {
    return cdp.send("Target.sendMessageToTarget", {
      sessionId,
      message: JSON.stringify({ id: nextId++, method, params }),
    });
  }
  cdp.on("Target.receivedMessageFromTarget", ({ message }) => {
    const event = JSON.parse(message);
    if (event.method === "Network.requestWillBeSent")
      requests.push({
        url: event.params.request.url,
        worker: true,
        at: Date.now(),
      });
  });
  cdp.on("Target.attachedToTarget", async ({ sessionId, targetInfo }) => {
    workers.add(targetInfo.targetId);
    await workerCommand(sessionId, "Network.enable");
    if (throttle)
      await workerCommand(sessionId, "Network.emulateNetworkConditionsByRule", {
        offline: false,
        matchedNetworkConditions: [
          {
            urlPattern: "",
            latency: 150,
            downloadThroughput: 200000,
            uploadThroughput: 93750,
          },
        ],
      });
    await workerCommand(sessionId, "Runtime.runIfWaitingForDebugger");
  });
  cdp.on("Target.detachedFromTarget", ({ targetId }) =>
    workers.delete(targetId),
  );
  await cdp.send("Target.setAutoAttach", {
    autoAttach: true,
    waitForDebuggerOnStart: true,
    flatten: false,
  });
  cdp.on("Network.requestWillBeSent", (e) =>
    requests.push({ url: e.request.url, worker: false, at: Date.now() }),
  );
  const cached = { hit: 0, net: 0 };
  cdp.on("Network.responseReceived", (e) => {
    if (e.response.fromDiskCache || e.response.fromPrefetchCache) cached.hit++;
    else cached.net++;
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  return { context, page, cdp, requests, workers, cached, errors };
}

const mapReady = (page) =>
  page.waitForFunction(() => window.prototype?.metrics?.ready > 0, null, {
    timeout: 120000,
  });
async function openMenu(page, scope) {
  await page.click(`${scope} .site-menu-button`);
  await page.locator(`${scope} .site-menu-panel:popover-open`).waitFor();
}
const stats = (values) => {
  const v = [...values].sort((a, b) => a - b);
  const mid =
    v.length % 2
      ? v[(v.length - 1) / 2]
      : (v[v.length / 2 - 1] + v[v.length / 2]) / 2;
  return {
    n: v.length,
    median: Math.round(mid),
    min: Math.round(v[0]),
    max: Math.round(v.at(-1)),
  };
};

async function warm(page) {
  await page.goto(`${origin}/`, { waitUntil: "domcontentloaded" });
  await mapReady(page);
  await page.waitForTimeout(3000);
  await page.goto(`${origin}/cards`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__listShownAt > 0, null, {
    timeout: 120000,
  });
  await page.waitForTimeout(1000);
}

async function base() {
  const s = await newPage();
  const { page } = s;
  await warm(page);
  await page.goto(`${origin}/`, { waitUntil: "domcontentloaded" });
  await mapReady(page);
  await page.waitForTimeout(3000);
  const rows = [];
  for (let run = 1; run <= runs; run++) {
    await openMenu(page, ".map-search-bar");
    s.cached.hit = s.cached.net = 0;
    await page.click('.map-search-bar .site-menu-panel a[href^="/cards"]');
    await page.waitForURL("**/cards", { waitUntil: "commit" });
    await page.waitForFunction(() => window.__listShownAt > 0, null, {
      timeout: 120000,
    });
    const m2l = await page.evaluate(
      () =>
        performance.timeOrigin +
        window.__listShownAt -
        Number(sessionStorage.spikeClickAbs),
    );
    const m2lCache = { ...s.cached };
    await page.waitForTimeout(1500);
    await openMenu(page, ".site-header");
    s.cached.hit = s.cached.net = 0;
    await page.click('.site-header .site-menu-panel a[href="/"]');
    await page.waitForURL(`${origin}/`, { waitUntil: "commit" });
    await mapReady(page);
    const l2m = await page.evaluate(
      () =>
        performance.timeOrigin +
        window.prototype.metrics.ready -
        Number(sessionStorage.spikeClickAbs),
    );
    rows.push({ run, m2l, l2m, m2lCache, l2mCache: { ...s.cached } });
    console.log(run, Math.round(m2l), Math.round(l2m), m2lCache, s.cached);
    await page.waitForTimeout(3000);
  }
  const summary = {
    m2l: stats(rows.map((r) => r.m2l)),
    l2m: stats(rows.map((r) => r.l2m)),
  };
  console.log(summary, s.errors);
  await writeFile(
    `${out}/samples.json`,
    JSON.stringify({ rows, summary, errors: s.errors }, null, 2),
  );
}

async function toCards(page) {
  await page.evaluate(() => {
    window.__listShownAt = 0;
    window
      .__waitVisible("#cards-root .catalog-regions button[data-pref]")
      .then((t) => (window.__listShownAt = t));
  });
  await openMenu(page, ".map-search-bar");
  await page.click('.map-search-bar .site-menu-panel a[href^="/cards"]');
  await page.waitForFunction(() => window.__listShownAt > 0, null, {
    timeout: 120000,
  });
  return page.evaluate(
    () => window.__listShownAt - window.__spike.lastCardsClick,
  );
}
async function toMap(page, how) {
  await page.evaluate(() => {
    window.__spike.lastMapShown = 0;
    window.__idleAt = 0;
    window.__spikeMap.once("idle", () => (window.__idleAt = performance.now()));
  });
  if (how === "back") await page.goBack({ waitUntil: "commit" });
  else {
    await openMenu(page, ".site-header");
    await page.click('.site-header .site-menu-panel a[href="/"]');
  }
  await page.waitForFunction(
    () => window.__spike.lastMapShown > 0 && window.__idleAt > 0,
    null,
    { timeout: 60000 },
  );
  return page.evaluate(() => {
    const s = window.__spike;
    return {
      shown: s.lastMapShown - s.lastMapClick,
      render: s.lastMapRender - s.lastMapClick,
      idle: window.__idleAt - s.lastMapClick,
    };
  });
}
async function dragCheck(page) {
  const before = await page.evaluate(() =>
    window.__spikeMap.getCenter().toArray(),
  );
  await page.mouse.move(206, 520);
  await page.mouse.down();
  await page.mouse.move(256, 560, { steps: 5 });
  await page.mouse.move(306, 600, { steps: 5 });
  await page.mouse.up();
  await page.waitForTimeout(800);
  const after = await page.evaluate(() =>
    window.__spikeMap.getCenter().toArray(),
  );
  return before[0] !== after[0] || before[1] !== after[1];
}

async function spikeRuns() {
  const s = await newPage();
  const { page } = s;
  await warm(page);
  const rows = [];
  for (let run = 1; run <= runs; run++) {
    await page.goto(`${origin}/`, { waitUntil: "domcontentloaded" });
    await mapReady(page);
    await page.waitForTimeout(3000);
    const first = await toCards(page);
    await page.waitForTimeout(1500);
    const linkBack = await toMap(page, "link");
    const moved = await dragCheck(page);
    await page.waitForTimeout(1500);
    const second = await toCards(page);
    await page.waitForTimeout(1500);
    const historyBack = await toMap(page, "back");
    await page.waitForTimeout(1500);
    const creates = await page.evaluate(() => window.__spikeMapCreates);
    rows.push({ run, first, second, linkBack, historyBack, moved, creates });
    console.log(
      run,
      Math.round(first),
      Math.round(second),
      linkBack,
      historyBack,
      moved,
      creates,
    );
  }
  if (process.env.SHOT)
    await page.screenshot({ path: `${out}/restored-map.png` });
  const summary = {
    m2lFirst: stats(rows.map((r) => r.first)),
    m2lSecond: stats(rows.map((r) => r.second)),
    l2mLinkShown: stats(rows.map((r) => r.linkBack.shown)),
    l2mLinkRender: stats(rows.map((r) => r.linkBack.render)),
    l2mLinkIdle: stats(rows.map((r) => r.linkBack.idle)),
    l2mBackShown: stats(rows.map((r) => r.historyBack.shown)),
    l2mBackIdle: stats(rows.map((r) => r.historyBack.idle)),
    allMoved: rows.every((r) => r.moved),
  };
  console.log(summary, s.errors);
  await writeFile(
    `${out}/samples.json`,
    JSON.stringify({ rows, summary, errors: s.errors }, null, 2),
  );
}

async function sample(s) {
  await s.cdp.send("HeapProfiler.collectGarbage");
  const metrics = Object.fromEntries(
    (await s.cdp.send("Performance.getMetrics")).metrics.map((m) => [
      m.name,
      m.value,
    ]),
  );
  const page = await s.page.evaluate(() => ({
    creates: window.__spikeMapCreates,
    webgl: window.__webgl,
    workersCreated: window.__workersCreated,
    workersTerminated: window.__workersTerminated,
    canvases: document.querySelectorAll("canvas").length,
    styleSheets: document.styleSheets.length,
    domNodes: document.getElementsByTagName("*").length,
  }));
  return {
    ...page,
    workerTargets: s.workers.size,
    nodes: metrics.Nodes,
    listeners: metrics.JSEventListeners,
    heapMB: +(metrics.JSHeapUsedSize / 1048576).toFixed(2),
    documents: metrics.Documents,
  };
}

async function soak() {
  const s = await newPage();
  const { page } = s;
  await warm(page);
  await page.goto(`${origin}/`, { waitUntil: "domcontentloaded" });
  await mapReady(page);
  await page.waitForTimeout(3000);
  const trend = [{ trip: 0, ...(await sample(s)) }];
  const m2l = [],
    l2m = [];
  for (let trip = 1; trip <= 30; trip++) {
    m2l.push(await toCards(page));
    await page.waitForTimeout(300);
    l2m.push((await toMap(page, trip % 2 ? "link" : "back")).shown);
    await page.waitForTimeout(300);
    if ([1, 5, 10, 15, 20, 25, 30].includes(trip)) {
      trend.push({ trip, ...(await sample(s)) });
      console.log(trend.at(-1));
    }
  }
  const summary = {
    m2l: stats(m2l.slice(1)),
    l2m: stats(l2m),
    historyLength: await page.evaluate(() => history.length),
  };
  console.log(summary, s.errors);
  await writeFile(
    `${out}/soak.json`,
    JSON.stringify({ trend, m2l, l2m, summary, errors: s.errors }, null, 2),
  );
}

async function hidden() {
  const s = await newPage();
  const { page, cdp } = s;
  await warm(page);
  await page.goto(`${origin}/`, { waitUntil: "domcontentloaded" });
  await mapReady(page);
  await page.waitForTimeout(4000);
  const windowMs = 5000;
  async function measure(name) {
    await page.evaluate(() => {
      window.__renders = 0;
      window.__rafs = 0;
      window.__countRender = () => window.__renders++;
      window.__spikeMap.on("render", window.__countRender);
      const raf = window.requestAnimationFrame;
      window.__origRaf = raf;
    });
    const start = Date.now();
    const m0 = Object.fromEntries(
      (await cdp.send("Performance.getMetrics")).metrics.map((m) => [
        m.name,
        m.value,
      ]),
    );
    await page.waitForTimeout(windowMs);
    const m1 = Object.fromEntries(
      (await cdp.send("Performance.getMetrics")).metrics.map((m) => [
        m.name,
        m.value,
      ]),
    );
    const res = await page.evaluate(() => {
      window.__spikeMap.off("render", window.__countRender);
      const c = window.__spikeMap.getCanvas();
      return {
        renders: window.__renders,
        canvas: [c.width, c.height],
        container: [c.parentElement.clientWidth, c.parentElement.clientHeight],
      };
    });
    const tiles = s.requests.filter(
      (r) => r.at >= start && /cartocdn|\.pbf|tiles/.test(r.url),
    ).length;
    const row = {
      name,
      ...res,
      tileRequests: tiles,
      allRequests: s.requests.filter((r) => r.at >= start).length,
      taskMs: Math.round((m1.TaskDuration - m0.TaskDuration) * 1000),
      scriptMs: Math.round((m1.ScriptDuration - m0.ScriptDuration) * 1000),
      layoutCount: m1.LayoutCount - m0.LayoutCount,
      recalcStyleCount: m1.RecalcStyleCount - m0.RecalcStyleCount,
    };
    console.log(row);
    return row;
  }
  const rows = [await measure("map visible, idle")];
  // Start a camera animation, then hide the map mid-flight.
  await toCards(page);
  await page.waitForTimeout(2000);
  rows.push(await measure("map hidden, cards idle"));
  await toMap(page, "back");
  await page.waitForTimeout(2000);
  await page.evaluate(() =>
    window.__spikeMap.flyTo({
      center: [139.7, 35.68],
      zoom: 11,
      duration: 6000,
    }),
  );
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    window.__listShownAt = 0;
    window
      .__waitVisible("#cards-root .catalog-regions button[data-pref]")
      .then((t) => (window.__listShownAt = t));
    document
      .querySelector(".map-search-bar .site-menu-panel a[href^='/cards']")
      .click();
  });
  await page.waitForFunction(() => window.__listShownAt > 0);
  rows.push(await measure("hidden during flyTo (6s)"));
  await writeFile(
    `${out}/hidden.json`,
    JSON.stringify({ rows, errors: s.errors }, null, 2),
  );
  console.log(s.errors);
}

async function direct() {
  const s = await newPage();
  const { page } = s;
  await page.goto(`${origin}/cards`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__listShownAt > 0, null, {
    timeout: 120000,
  });
  await page.waitForTimeout(4000);
  const mapish = s.requests.filter((r) =>
    /maplibre|card-map|map-page|worker|main-[^/]*\.(js|css)|cartocdn/.test(
      r.url,
    ),
  );
  const res = {
    total: s.requests.length,
    mapish,
    workers: s.workers.size,
    urls: s.requests.map((r) => r.url.replace(origin, "")),
  };
  console.log(JSON.stringify(res, null, 2));
  await writeFile(`${out}/direct.json`, JSON.stringify(res, null, 2));
}

async function css() {
  // Unthrottled screenshots of the catalog: its own document vs. the map document.
  const s = await newPage();
  const { page } = s;
  const shots = {};
  async function cardsStates(prefix) {
    await page.waitForTimeout(800);
    await page.screenshot({
      path: `${out}/${prefix}-regions.png`,
      fullPage: true,
    });
    shots[`${prefix}-height`] = await page.evaluate(
      () => document.documentElement.scrollHeight,
    );
    shots[`${prefix}-boxes`] = await page.evaluate(() =>
      [
        ".site-header",
        ".site-brand",
        ".site-brand svg",
        ".site-menu-button",
        ".site-menu-button svg",
        ".catalog-intro",
        ".catalog-intro h1",
        ".catalog-search",
        ".catalog-search input",
        ".catalog-regions",
        ".catalog-region button",
        ".catalog-footer",
      ].map((sel) => {
        const el = document.querySelector(sel);
        if (!el) return [sel, null];
        const r = el.getBoundingClientRect();
        return [
          sel,
          Math.round(r.top + scrollY),
          Math.round(r.height),
          Math.round(r.width),
          getComputedStyle(el).display,
        ];
      }),
    );
    await page.click('.catalog-regions button[data-pref="13"]');
    await page.waitForSelector(".catalog-row, [id^=catalog-row-]");
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${out}/${prefix}-pref.png` });
    await page.locator("[id^=catalog-row-]").first().click();
    await page.waitForSelector("#catalog-detail-title");
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${out}/${prefix}-detail.png` });
    shots[`${prefix}-styles`] = await page.evaluate(() => {
      const q = (sel) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const c = getComputedStyle(el);
        return {
          margin: c.margin,
          padding: c.padding,
          font: c.font,
          minHeight: c.minHeight,
          border: c.border,
          background: c.backgroundColor,
          listStyle: c.listStyle,
        };
      };
      return {
        h1: q(".cards-page h1"),
        h2: q(".cards-page h2"),
        button: q(".cards-page button"),
        input: q(".cards-page input"),
        a: q(".cards-page a"),
        ul: q(".cards-page ul"),
        img: q(".cards-page img"),
        body: q("body"),
      };
    });
  }
  await page.goto(`${origin}/cards`);
  await page.waitForFunction(() => window.__listShownAt > 0);
  await cardsStates("doc");
  await page.goto(`${origin}/`);
  await mapReady(page);
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${out}/map-before.png` });
  shots.mapBefore = await page.evaluate(() =>
    [...document.styleSheets].map((x) => x.href?.replace(location.origin, "")),
  );
  await toCards(page);
  await cardsStates("spike");
  while (new URL(page.url()).pathname === "/cards") {
    await page.goBack();
    await page.waitForTimeout(300);
  }
  await page.waitForFunction(() => !document.getElementById("cards-root"));
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${out}/map-after.png` });
  shots.mapAfter = await page.evaluate(() =>
    [...document.styleSheets].map((x) => x.href?.replace(location.origin, "")),
  );
  shots.url = page.url();
  shots.errors = s.errors;
  await writeFile(`${out}/css.json`, JSON.stringify(shots, null, 2));
  console.log(JSON.stringify(shots, null, 2));
}

try {
  await { base, spike: spikeRuns, soak, hidden, direct, css }[mode]();
} finally {
  await browser.close();
}
