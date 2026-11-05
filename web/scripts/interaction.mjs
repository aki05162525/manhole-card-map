import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
await mkdir("results", { recursive: true });
for (
  let run = Number(process.env.RUN_START || 1);
  run <= Number(process.env.RUNS || 5);
  run++
)
  for (const engine of ["a", "b"]) {
    const browser = await chromium.launch({
      executablePath: process.env.CHROME || "/usr/bin/google-chrome",
      args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
    });
    try {
      const context = await browser.newContext({
        viewport: { width: 412, height: 823 },
        deviceScaleFactor: 1.75,
        isMobile: true,
        hasTouch: true,
      });
      const page = await context.newPage(),
        session = await context.newCDPSession(page);
      await session.send("Network.enable");
      await session.send("Emulation.setCPUThrottlingRate", { rate: 4 });
      await session.send("Network.emulateNetworkConditions", {
        offline: false,
        latency: 150,
        downloadThroughput: 200000,
        uploadThroughput: 93750,
        connectionType: "cellular4g",
      });
      await page.goto(`http://127.0.0.1:4173/?engine=${engine}&benchmark`);
      await page.waitForFunction(
        () =>
          window.prototype?.metrics.ready > 0 &&
          document.querySelector("#offline").textContent.includes("準備完了"),
        null,
        { timeout: 90000 },
      );
      await page.reload();
      await page.waitForFunction(
        () => window.prototype?.metrics.ready > 0,
        null,
        {
          timeout: 90000,
        },
      );
      // 起動計測と同じく、ピンを1つ選んで閉じてから共通の操作列を実行する。
      const point = await page.evaluate(() =>
        window.prototype.adapter.tapPoint(),
      );
      if (point) {
        const box = await page.locator("#map").boundingBox();
        await page.mouse.click(box.x + point.x, box.y + point.y);
        await page.waitForFunction(
          () => window.prototype.metrics.taps.length > 0,
        );
        await page.locator("#detail button").click();
      }
      await session.send("Tracing.start", {
        categories: "devtools.timeline,blink.user_timing,cc,benchmark,toplevel",
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
        session.once("Tracing.tracingComplete", resolve),
      );
      await session.send("Tracing.end");
      const { stream } = await done;
      let trace = "";
      while (true) {
        const part = await session.send("IO.read", { handle: stream });
        trace += part.data;
        if (part.eof) break;
      }
      await session.send("IO.close", { handle: stream });
      await writeFile(`results/interaction-${engine}-${run}.trace.json`, trace);
      await writeFile(
        `results/frames-${engine}-${run}.json`,
        JSON.stringify(frames),
      );
      console.log(
        engine,
        run,
        "frames",
        frames.length,
        "over33ms",
        frames.filter((x) => x > 33.4).length,
      );
    } finally {
      await browser.close();
    }
  }
