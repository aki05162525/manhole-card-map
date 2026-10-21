import lighthouse from "lighthouse";
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
await mkdir("results", { recursive: true });
const rows = [];
for (let run = 1; run <= Number(process.env.RUNS || 5); run++)
  for (const engine of (process.env.ENGINES || "a,b").split(",")) {
    const browser = await chromium.launch({
      executablePath: process.env.CHROME || "/usr/bin/google-chrome",
      headless: true,
      args: [
        "--no-sandbox",
        "--enable-unsafe-swiftshader",
        "--remote-debugging-port=9222",
      ],
    });
    for (const cache of ["cold", "warm"]) {
      const url = `http://127.0.0.1:4173/?engine=${engine}&benchmark`;
      const result = await lighthouse(url, {
        port: 9222,
        output: "json",
        logLevel: "error",
        onlyCategories: ["performance"],
        formFactor: "mobile",
        throttlingMethod: "devtools",
        disableStorageReset: cache === "warm",
        maxWaitForLoad: 90000,
      });
      await writeFile(
        `results/lighthouse-${engine}-${run}-${cache}.json`,
        result.report,
      );
      const pages = browser.contexts().flatMap((c) => c.pages());
      const page = pages.find((p) => p.url() === url);
      const metrics = page
        ? await page.evaluate(() => window.prototype?.metrics)
        : null;
      const row = {
        engine,
        run,
        cache,
        metrics,
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
          metrics,
          score: row.score,
          lcp: row.lcp,
          errors: row.errors,
        }),
      );
      await writeFile("results/lighthouse.json", JSON.stringify(rows, null, 2));
      if (page)
        await page.waitForFunction(
          () =>
            document.querySelector("#offline").textContent.includes("準備完了"),
          null,
          { timeout: 90000 },
        );
    }
    await browser.close();
  }
