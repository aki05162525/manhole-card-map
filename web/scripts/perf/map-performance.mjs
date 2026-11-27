// Real national data + real basemap. Never route requests (routing disables cache).
import { enableMapDiagnostics } from "../browser/enable-map-diagnostics.mjs";
import { chromium } from "playwright";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { brotliCompressSync, gzipSync } from "node:zlib";
import { platform, release, cpus } from "node:os";
const origin = process.env.REAL_DATA_ORIGIN || "https://manhole-techo.com";
const runs = Number(process.env.RUNS || 5);
const directory = `results/map-performance/${process.argv[2] || "production"}`;
await mkdir(directory, { recursive: true });
const browser = await chromium.launch({
  ...(process.env.CHROME ? { executablePath: process.env.CHROME } : {}),
  args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
});
const conditions = {
  origin,
  runs,
  browser: browser.version(),
  os: `${platform()} ${release()}`,
  cpu: cpus()[0].model,
  viewport: { width: 412, height: 915 },
  isMobile: true,
  deviceScaleFactor: 1.75,
  cpuRate: 4,
  latency: 150,
  downloadThroughput: 1600000 / 8,
  uploadThroughput: 750000 / 8,
};
const rows = process.env.START_RUN
  ? JSON.parse(await readFile(`${directory}/samples.json`, "utf8")).rows
  : [];
try {
  for (let run = Number(process.env.START_RUN || 1); run <= runs; run++) {
    const context = await browser.newContext({
      viewport: conditions.viewport,
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 1.75,
    });
    await enableMapDiagnostics(context);
    await context.addInitScript(() => {
      window.perfSample = { longTasks: [], events: [], lcp: 0, search: 0 };
      new PerformanceObserver((list) => {
        for (const e of list.getEntries())
          window.perfSample.longTasks.push({
            start: e.startTime,
            duration: e.duration,
          });
      }).observe({ type: "longtask", buffered: true });
      new PerformanceObserver((list) => {
        window.perfSample.lcp = list.getEntries().at(-1).startTime;
      }).observe({ type: "largest-contentful-paint", buffered: true });
      new PerformanceObserver((list) => {
        for (const e of list.getEntries())
          window.perfSample.events.push({
            name: e.name,
            startTime: e.startTime,
            duration: e.duration,
            interactionId: e.interactionId,
          });
      }).observe({ type: "event", buffered: true, durationThreshold: 16 });
      new MutationObserver(() => {
        const button = document.querySelector('[aria-label="カードを検索"]');
        if (button && !button.disabled && !window.perfSample.search)
          window.perfSample.search = performance.now();
      }).observe(document, { childList: true, subtree: true });
    });
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await cdp.send("Network.enable");
    await cdp.send("Performance.enable");
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    await cdp.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: 150,
      downloadThroughput: 200000,
      uploadThroughput: 93750,
      connectionType: "cellular4g",
    });
    const resources = new Map(),
      bodies = new Map(),
      wireSizes = new Map(),
      pending = [];
    let nextId = 1;
    const commands = new Map();
    function workerCommand(sessionId, method, params = {}) {
      const id = nextId++;
      const result = new Promise((resolve, reject) =>
        commands.set(id, { resolve, reject }),
      );
      void cdp.send("Target.sendMessageToTarget", {
        sessionId,
        message: JSON.stringify({ id, method, params }),
      });
      return result;
    }
    function request(event, prefix = "") {
      resources.set(prefix + event.requestId, {
        url: event.request.url,
        type: event.type,
        start: event.timestamp,
        // Seconds since the epoch, to place the request on the page's clock.
        wall: event.wallTime,
        transfer: 0,
        worker: !!prefix,
      });
    }
    function response(event, prefix = "") {
      const row = resources.get(prefix + event.requestId);
      if (row)
        Object.assign(row, {
          status: event.response.status,
          mime: event.response.mimeType,
          encoding: event.response.headers["content-encoding"],
          cached: !!(
            event.response.fromDiskCache || event.response.fromServiceWorker
          ),
        });
    }
    function finished(event, prefix = "") {
      const row = resources.get(prefix + event.requestId);
      if (row)
        Object.assign(row, {
          transfer: event.encodedDataLength,
          end: event.timestamp,
        });
    }
    cdp.on("Target.receivedMessageFromTarget", ({ sessionId, message }) => {
      const event = JSON.parse(message);
      if (event.id) {
        const command = commands.get(event.id);
        if (command) {
          commands.delete(event.id);
          if (event.error)
            command.reject(new Error(JSON.stringify(event.error)));
          else command.resolve(event.result);
        }
      } else if (event.method === "Network.requestWillBeSent")
        request(event.params, sessionId);
      else if (event.method === "Network.responseReceived")
        response(event.params, sessionId);
      else if (event.method === "Network.loadingFinished") {
        finished(event.params, sessionId);
        pending.push(
          workerCommand(sessionId, "Network.getResponseBody", {
            requestId: event.params.requestId,
          })
            .then((result) => {
              const row = resources.get(sessionId + event.params.requestId);
              if (row)
                bodies.set(
                  row.url,
                  Buffer.from(
                    result.body,
                    result.base64Encoded ? "base64" : "utf8",
                  ),
                );
            })
            .catch(() => {}),
        );
      }
    });
    const workerSetup = [];
    cdp.on("Target.attachedToTarget", ({ sessionId, targetInfo }) => {
      workerSetup.push(
        (async () => {
          await workerCommand(sessionId, "Network.enable");
          await workerCommand(
            sessionId,
            "Network.emulateNetworkConditionsByRule",
            {
              offline: false,
              matchedNetworkConditions: [
                {
                  urlPattern: "",
                  latency: 150,
                  downloadThroughput: 200000,
                  uploadThroughput: 93750,
                },
              ],
            },
          );
          await workerCommand(sessionId, "Runtime.runIfWaitingForDebugger");
          console.log("throttled target", targetInfo.type);
        })(),
      );
    });
    await cdp.send("Target.setAutoAttach", {
      autoAttach: true,
      waitForDebuggerOnStart: true,
      flatten: false,
    });
    cdp.on("Network.requestWillBeSent", (e) => request(e));
    cdp.on("Network.responseReceived", (e) => response(e));
    cdp.on("Network.loadingFinished", (e) => finished(e));
    context.on("response", (response) =>
      pending.push(
        (async () => {
          try {
            const b = await response.body();
            bodies.set(response.url(), b);
            wireSizes.set(response.url(), await response.request().sizes());
          } catch {
            /* Preserve failed requests in CDP results. */
          }
        })(),
      ),
    );
    for (const cache of ["cold", "warm"]) {
      resources.clear();
      bodies.clear();
      wireSizes.clear();
      pending.length = 0;
      const errors = [],
        onError = (e) => errors.push(String(e));
      page.on("pageerror", onError);
      await cdp.send("Tracing.start", {
        categories:
          "devtools.timeline,v8,blink.user_timing,cc,benchmark,toplevel",
        transferMode: "ReturnAsStream",
      });
      await page.goto(origin, {
        waitUntil: "domcontentloaded",
        timeout: 120000,
      });
      // The first view: the drawing before the map engine, measured and
      // pressable (`src/features/map/level-stage.tsx`).
      await page.waitForFunction(
        () => window.mapDiagnostics?.stage?.tapPoint("kanto"),
        null,
        { timeout: 120000 },
      );
      const startup = await page.evaluate(() => ({
        ...window.perfSample,
        // The national drawing can be pressed: the script's first press
        // waits for nothing more.
        pressable: performance.now(),
        metrics: window.mapDiagnostics.metrics,
        marks: performance
          .getEntriesByType("mark")
          .map(({ name, startTime }) => ({ name, startTime })),
        fcp: performance.getEntriesByName("first-contentful-paint")[0]
          ?.startTime,
      }));
      const cpu = (await cdp.send("Performance.getMetrics")).metrics;
      const startupResources = [...resources.values()].map((r) => ({ ...r }));
      const taps = [];
      for (let attempt = 0; attempt < 10; attempt++) {
        // The drawing while it is shown, the map once it is handed over.
        const point = await page.evaluate(
          (id) =>
            (
              window.mapDiagnostics.stage ?? window.mapDiagnostics.adapter
            )?.tapPoint(id) ?? null,
          taps.length === 0
            ? "kanto"
            : taps.length === 1
              ? "東京都"
              : undefined,
        );
        if (!point) {
          await page.waitForTimeout(500);
          continue;
        }
        const before = await page.evaluate(() => {
          const shown = () =>
            (
              window.mapDiagnostics.stage ?? window.mapDiagnostics.adapter
            )?.view() ?? null;
          const sample = {
            now: performance.now(),
            view: shown(),
            lastChange: 0,
            frames: [],
            active: true,
          };
          window.tapSample = sample;
          let previous = JSON.stringify(sample.view),
            last = sample.now;
          const frame = (now) => {
            sample.frames.push(now - last);
            last = now;
            const next = JSON.stringify(shown());
            if (next !== previous) {
              sample.lastChange = now;
              previous = next;
            }
            if (sample.active) requestAnimationFrame(frame);
          };
          requestAnimationFrame(frame);
          return { now: sample.now, view: sample.view };
        });
        const box = await page.locator("#map").boundingBox();
        await page.mouse.click(box.x + point.x, box.y + point.y);
        await page.waitForTimeout(1500);
        const after = await page.evaluate(() => ({
          now: performance.now(),
          view: (
            window.mapDiagnostics.stage ?? window.mapDiagnostics.adapter
          )?.view(),
          taps: window.mapDiagnostics.metrics.taps,
          summary: !!document.querySelector("#detail .detail-title"),
        }));
        const camera = await page.evaluate(() => {
          window.tapSample.active = false;
          return window.tapSample;
        });
        taps.push({ before, after, camera });
        if (after.summary) break;
      }
      if (!taps.at(-1)?.after.summary) throw new Error("No pin detail reached");
      // The map that moves, read behind the drawing, before it is moved.
      await page.waitForFunction(
        () => window.mapDiagnostics?.metrics.ready > 0,
        null,
        { timeout: 120000 },
      );
      const movement = await page.evaluate(async () => {
        const gaps = [];
        let last = performance.now(),
          active = true;
        const frame = (now) => {
          gaps.push(now - last);
          last = now;
          if (active) requestAnimationFrame(frame);
        };
        requestAnimationFrame(frame);
        const start = performance.now();
        await window.mapDiagnostics.adapter.exercise();
        active = false;
        return { start, end: performance.now(), gaps };
      });
      const final = await page.evaluate(() => ({
        ...window.perfSample,
        timeOrigin: performance.timeOrigin,
        metrics: window.mapDiagnostics.metrics,
        // `stage-pins-ready`: a prefecture's facilities can be pressed.
        marks: performance
          .getEntriesByType("mark")
          .map(({ name, startTime }) => ({ name, startTime })),
        measures: performance
          .getEntriesByType("measure")
          .map(({ name, startTime, duration }) => ({
            name,
            startTime,
            duration,
          })),
      }));
      const complete = new Promise((resolve) =>
        cdp.once("Tracing.tracingComplete", resolve),
      );
      await cdp.send("Tracing.end");
      const { stream } = await complete;
      let trace = "";
      while (true) {
        const part = await cdp.send("IO.read", { handle: stream });
        trace += part.data;
        if (part.eof) break;
      }
      await cdp.send("IO.close", { handle: stream });
      await writeFile(`${directory}/${run}-${cache}.trace.json`, trace);
      await Promise.all(workerSetup);
      await Promise.all(pending);
      for (const [url, body] of bodies)
        bodies.set(url, {
          raw: body.length,
          wire: wireSizes.get(url),
          gzip: gzipSync(body, { level: 9 }).length,
          brotli: brotliCompressSync(body).length,
        });
      // On the page's clock (performance.now()), as the marks and the taps.
      const onPage = (r) =>
        r.wall
          ? {
              at: r.wall * 1000 - final.timeOrigin,
              done:
                r.end !== undefined
                  ? (r.wall + r.end - r.start) * 1000 - final.timeOrigin
                  : undefined,
            }
          : {};
      rows.push({
        run,
        cache,
        startup,
        cpu,
        taps,
        movement,
        final,
        errors,
        startupResources: startupResources.map((r) => ({
          ...r,
          ...onPage(r),
          ...bodies.get(r.url),
        })),
        resources: [...resources.values()].map((r) => ({
          ...r,
          ...onPage(r),
          ...bodies.get(r.url),
        })),
        bodies: Object.fromEntries(bodies),
      });
      await writeFile(
        `${directory}/samples.json`,
        JSON.stringify({ conditions, rows }, null, 2),
      );
      console.log(
        JSON.stringify({
          run,
          cache,
          ready: final.metrics.ready,
          prefPins: final.marks.find((e) => e.name === "stage-pins-ready")
            ?.startTime,
          search: startup.search,
          lcp: startup.lcp,
          taps: final.metrics.taps,
          errors,
        }),
      );
      page.off("pageerror", onError);
    }
    await context.close();
  }
} finally {
  await browser.close();
}
