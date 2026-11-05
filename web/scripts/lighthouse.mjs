import lighthouse from "lighthouse";
import puppeteer from "puppeteer-core";
import { mkdir, writeFile } from "node:fs/promises";
const resultDir = process.env.RESULTS_DIR || "results";
await mkdir(resultDir, { recursive: true });
const rows = [];
for (let run = 1; run <= Number(process.env.RUNS || 5); run++)
  for (const engine of (process.env.ENGINES || "a,b").split(",")) {
    const browser = await puppeteer.launch({
      executablePath: process.env.CHROME || "/usr/bin/google-chrome",
      headless: true,
      args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
    });
    const page = await browser.newPage();
    try {
      for (const cache of ["cold", "warm"]) {
        const url = `http://127.0.0.1:4173/?engine=${engine}&benchmark`;
        const result = await lighthouse(
          url,
          {
            output: "json",
            logLevel: "error",
            onlyCategories: ["performance"],
            formFactor: "mobile",
            throttlingMethod: "devtools",
            // 各組のブラウザを新規作成するため初回は空。終了時のSW削除を避ける。
            disableStorageReset: true,
            maxWaitForLoad: 90000,
          },
          undefined,
          page,
        );
        await writeFile(
          `${resultDir}/lighthouse-${engine}-${run}-${cache}.json`,
          result.report,
        );
        await page.waitForFunction(() => window.prototype?.metrics.ready > 0, {
          timeout: 90000,
        });
        // Lighthouse終了後も同じページを保持し、同じCPUと回線の条件で実際のピンをタップする。
        const session = await page.createCDPSession();
        const th = result.lhr.configSettings.throttling;
        await session.send("Emulation.setCPUThrottlingRate", {
          rate: th.cpuSlowdownMultiplier,
        });
        await session.send("Network.enable");
        await session.send("Network.emulateNetworkConditions", {
          offline: false,
          latency: th.requestLatencyMs,
          downloadThroughput: (th.downloadThroughputKbps * 1024) / 8,
          uploadThroughput: (th.uploadThroughputKbps * 1024) / 8,
        });
        const point = await page.evaluate(() =>
          window.prototype.adapter.tapPoint(),
        );
        if (point) {
          const box = await page.$eval("#map", (e) => {
            const b = e.getBoundingClientRect();
            return { x: b.x, y: b.y };
          });
          await page.mouse.click(box.x + point.x, box.y + point.y);
          await page.waitForFunction(
            () => window.prototype.metrics.taps.length > 0,
            {
              timeout: 10000,
            },
          );
        }
        const metrics = await page.evaluate(() => window.prototype.metrics);
        await page.waitForFunction(
          () =>
            document.querySelector("#offline").textContent.includes("準備完了"),
          { timeout: 90000 },
        );
        const row = {
          engine,
          run,
          cache,
          metrics,
          offlineReady: await page.evaluate(async () =>
            (await caches.keys()).some((k) => k.startsWith("prototype-")),
          ),
          settings: result.lhr.configSettings,
          score: result.lhr.categories.performance.score,
          lcp: result.lhr.audits["largest-contentful-paint"].numericValue,
          tbt: result.lhr.audits["total-blocking-time"].numericValue,
          timings: result.lhr.audits["user-timings"].details,
          errors: result.lhr.runtimeError || null,
        };
        rows.push(row);
        console.log(
          engine,
          run,
          cache,
          JSON.stringify({
            ready: metrics.ready,
            tap: metrics.taps.at(-1),
            score: row.score,
          }),
        );
        await writeFile(
          `${resultDir}/lighthouse.json`,
          JSON.stringify(rows, null, 2),
        );
        await session.detach();
      }
    } finally {
      await browser.close();
    }
  }
