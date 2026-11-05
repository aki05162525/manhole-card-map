import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
const executablePath = process.env.CHROME || "/usr/bin/google-chrome";
const count = Number(process.env.RUNS || 5),
  modes = (process.env.MODES || "full,split").split(","),
  engines = (process.env.ENGINES || "a,b").split(",");
await mkdir("results", { recursive: true });
const results = [];
for (const mode of modes)
  for (let run = 1; run <= count; run++)
    for (const engine of engines) {
      const browser = await chromium.launch({
        executablePath,
        headless: true,
        args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
      });
      const context = await browser.newContext({
        viewport: { width: 412, height: 823 },
        deviceScaleFactor: 1.75,
        isMobile: true,
        hasTouch: true,
      });
      const page = await context.newPage(),
        cdp = await context.newCDPSession(page);
      await cdp.send("Network.enable");
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
      await cdp.send("Network.emulateNetworkConditions", {
        offline: false,
        latency: 150,
        downloadThroughput: 1600000 / 8,
        uploadThroughput: 750000 / 8,
        connectionType: "cellular4g",
      });
      await page.route("**/*", (route) => {
        const url = route.request().url();
        if (/gk-p\.jp/.test(url)) route.abort();
        else route.continue();
      });
      // route は HTTP キャッシュを無効化するため、GKP 遮断を CDP に移して route を解除する。
      await page.unroute("**/*");
      await cdp.send("Network.setBlockedURLs", { urls: ["*gk-p.jp*"] });
      const resources = new Map();
      cdp.on("Network.requestWillBeSent", (e) =>
        resources.set(e.requestId, {
          url: e.request.url,
          wall: e.wallTime * 1000,
          bytes: 0,
          cached: false,
        }),
      );
      cdp.on("Network.responseReceived", (e) => {
        const r = resources.get(e.requestId);
        if (r) {
          r.status = e.response.status;
          r.cached = !!(
            e.response.fromDiskCache || e.response.fromServiceWorker
          );
        }
      });
      cdp.on("Network.loadingFinished", (e) => {
        const r = resources.get(e.requestId);
        if (r) r.bytes = e.encodedDataLength;
      });
      for (const cache of ["cold", "warm"]) {
        resources.clear();
        const errors = [];
        const error = (e) => errors.push(String(e));
        page.on("pageerror", error);
        const traceName = `cdp-${engine}-${mode}-${run}-${cache}`;
        await cdp.send("Tracing.start", {
          categories:
            "devtools.timeline,blink.user_timing,cc,benchmark,toplevel",
          transferMode: "ReturnAsStream",
        });
        await page.goto(
          `http://127.0.0.1:4173/?engine=${engine}&data=${mode}&benchmark`,
          {
            waitUntil: "domcontentloaded",
            timeout: 90000,
          },
        );
        try {
          await page.waitForFunction(
            () =>
              window.prototype?.metrics.ready > 0 ||
              window.prototype?.metrics.errors.length > 0,
            null,
            { timeout: 90000 },
          );
        } catch (e) {
          errors.push(String(e));
        }
        const observed = await page.evaluate(() => ({
          metrics: window.prototype?.metrics,
          origin: performance.timeOrigin,
          ua: navigator.userAgent,
        }));
        const startupResources = [...resources.values()].filter(
          (r) => r.wall <= observed.origin + (observed.metrics?.ready || 0),
        );
        let tap = null;
        if (observed.metrics?.ready) {
          const point = await page.evaluate(() =>
            window.prototype.adapter.tapPoint(),
          );
          if (point) {
            const box = await page.locator("#map").boundingBox();
            await page.mouse.click(box.x + point.x, box.y + point.y);
            await page.waitForFunction(
              () => window.prototype.metrics.taps.length > 0,
              null,
              {
                timeout: 10000,
              },
            );
            tap = await page.evaluate(() =>
              window.prototype.metrics.taps.at(-1),
            );
            await page.locator("#detail button").click();
          }
        }
        const completed = new Promise((resolve) =>
          cdp.once("Tracing.tracingComplete", resolve),
        );
        await cdp.send("Tracing.end");
        const { stream } = await completed;
        let trace = "";
        while (true) {
          const part = await cdp.send("IO.read", { handle: stream });
          trace += part.data;
          if (part.eof) break;
        }
        await cdp.send("IO.close", { handle: stream });
        await writeFile(`results/${traceName}.trace.json`, trace);
        const row = {
          engine,
          mode,
          run,
          cache,
          ...observed,
          tap,
          errors,
          resources: startupResources,
        };
        results.push(row);
        console.log(
          engine,
          mode,
          run,
          cache,
          "ready",
          observed.metrics?.ready,
          "tap",
          tap,
          "errors",
          errors.length,
        );
        await writeFile("results/cdp.json", JSON.stringify(results, null, 2));
        await page.waitForFunction(
          () =>
            document.querySelector("#offline").textContent.includes("準備完了"),
          null,
          { timeout: 90000 },
        );
        if (cache === "warm" && run === 1 && mode === "full") {
          await cdp.send("Tracing.start", {
            categories:
              "devtools.timeline,blink.user_timing,cc,benchmark,toplevel",
            transferMode: "ReturnAsStream",
          });
          const frames = await page.evaluate(async () => {
            const gaps = [];
            let last = performance.now(),
              active = true;
            function frame(now) {
              gaps.push(now - last);
              last = now;
              if (active) requestAnimationFrame(frame);
            }
            requestAnimationFrame(frame);
            await window.prototype.adapter.exercise();
            active = false;
            return gaps;
          });
          const done = new Promise((resolve) =>
            cdp.once("Tracing.tracingComplete", resolve),
          );
          await cdp.send("Tracing.end");
          const { stream } = await done;
          let trace = "";
          while (true) {
            const part = await cdp.send("IO.read", { handle: stream });
            trace += part.data;
            if (part.eof) break;
          }
          await cdp.send("IO.close", { handle: stream });
          await writeFile(`results/interaction-${engine}-1.trace.json`, trace);
          await writeFile(
            `results/frames-${engine}-1.json`,
            JSON.stringify(frames),
          );
          await page.screenshot({ path: `results/interaction-${engine}.png` });
        }
        page.off("pageerror", error);
      }
      // 保存完了後のオフラインで一覧と詳細が使えることを確認する。
      if (run === 1 && mode === "full") {
        await context.setOffline(true);
        await page.reload({ waitUntil: "domcontentloaded" });
        await page.waitForFunction(
          () => document.querySelector("#cards").options.length > 1300,
        );
        await page.locator("#cards").selectOption({ index: 1 });
        await page.locator("#detail h2").waitFor();
        await writeFile(
          `results/offline-${engine}.json`,
          JSON.stringify({
            options: await page.locator("#cards option").count(),
            detail: await page.locator("#detail").innerText(),
            notice: await page.locator("#notice").innerText(),
          }),
        );
      }
      await browser.close();
    }
