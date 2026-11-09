// Existing real-data production server required; this script never starts one.
import { chromium } from "playwright";
import { mkdir, readFile, writeFile } from "node:fs/promises";
const origin = process.env.REAL_DATA_ORIGIN || "http://127.0.0.1:4188";
const label = process.argv[2] || "measurement";
const out = `results/sheet-smooth/${label}`;
await mkdir(out, { recursive: true });
function analyze(events, mode, run) {
  const mark = (name) => {
    const event = events.find(
      (e) => e.name === name && e.cat?.includes("user_timing"),
    );
    if (!event) throw new Error(`Missing trace mark: ${name}`);
    return event.ts;
  };
  const action = mark("sheet-action"),
    end = mark("sheet-motion-end");
  const start = mark("sheet-motion-start");
  const summarize = (from, to) => {
    const within = events.filter((e) => e.ts >= from && e.ts <= to);
    const main = events.find(
      (e) => e.name === "sheet-action" && e.cat?.includes("user_timing"),
    );
    const durations = (name) =>
      within.filter(
        (e) =>
          e.name === name &&
          e.ph === "X" &&
          e.pid === main.pid &&
          e.tid === main.tid,
      );
    const layouts = durations("Layout"),
      styles = durations("UpdateLayoutTree");
    const tasks = durations("RunTask").filter((e) => e.dur >= 50000);
    return {
      durationMs: +((to - from) / 1000).toFixed(2),
      longTasks: tasks.length,
      maxTaskMs: +(
        Math.max(0, ...durations("RunTask").map((e) => e.dur)) / 1000
      ).toFixed(2),
      layouts: layouts.length,
      layoutMs: +(layouts.reduce((n, e) => n + e.dur, 0) / 1000).toFixed(2),
      styles: styles.length,
      styleMs: +(styles.reduce((n, e) => n + e.dur, 0) / 1000).toFixed(2),
      droppedFrames: within.filter((e) => e.name === "DroppedFrame").length,
    };
  };
  return {
    mode,
    run,
    action: summarize(action, end),
    motion: summarize(start, end),
    includingSettle: summarize(
      action,
      Math.min(mark("sheet-done"), end + 100000),
    ),
  };
}
if (process.argv.includes("--analyze")) {
  const results = [];
  for (const mode of ["swipe", "button"])
    for (let run = 1; run <= 3; run++) {
      const { traceEvents } = JSON.parse(
        await readFile(`${out}/${mode}-${run}.trace.json`, "utf8"),
      );
      results.push(analyze(traceEvents, mode, run));
    }
  await writeFile(`${out}/summary.json`, JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
  process.exit(0);
}
const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({
    viewport: { width: 412, height: 915 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 1,
    colorScheme: "light",
  });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  const data = await (
    await context.request.get(`${origin}/data/full.json`)
  ).json();
  if (data.cards.length < 1000 || !data.evaluatedAt)
    throw new Error("Generate real data and serve the production build first");
  const results = [];
  for (const mode of ["swipe", "button"])
    for (let run = 1; run <= 3; run++) {
      await page.goto(`${origin}/?card=01-226-A001`);
      await page.locator("#locate:not(:disabled)").waitFor();
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(2500);
      const events = [];
      const collect = ({ value }) => events.push(...value);
      cdp.on("Tracing.dataCollected", collect);
      await cdp.send("Tracing.start", {
        categories:
          "devtools.timeline,disabled-by-default-devtools.timeline,disabled-by-default-devtools.timeline.frame,toplevel,blink.user_timing,cc",
        transferMode: "ReportEvents",
      });
      await page.evaluate(() => {
        performance.mark("sheet-action");
        const panel = document.querySelector("#detail");
        panel.addEventListener("transitionstart", (e) => {
          if (e.target === panel && e.propertyName === "transform")
            performance.mark("sheet-motion-start");
        });
        panel.addEventListener("transitionend", (e) => {
          if (e.target === panel && e.propertyName === "transform")
            performance.mark("sheet-motion-end");
        });
      });
      if (mode === "button")
        await page.getByRole("button", { name: "詳しく", exact: true }).click();
      else {
        const box = await page.locator(".detail-drag-handle").boundingBox();
        const y = box.y + box.height / 2;
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchStart",
          touchPoints: [{ x: 190, y }],
        });
        for (let step = 1; step <= 12; step++) {
          await cdp.send("Input.dispatchTouchEvent", {
            type: "touchMove",
            touchPoints: [{ x: 190, y: y - step * 15 }],
          });
          await page.waitForTimeout(16);
        }
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchEnd",
          touchPoints: [],
        });
      }
      await page.locator("#detail.is-full").waitFor();
      await page.waitForTimeout(700);
      await page.evaluate(() => performance.mark("sheet-done"));
      const complete = new Promise((resolve) =>
        cdp.once("Tracing.tracingComplete", resolve),
      );
      await cdp.send("Tracing.end");
      await complete;
      cdp.off("Tracing.dataCollected", collect);
      await writeFile(
        `${out}/${mode}-${run}.trace.json`,
        JSON.stringify({ traceEvents: events }),
      );
      results.push(analyze(events, mode, run));
    }
  await writeFile(`${out}/summary.json`, JSON.stringify(results, null, 2));
  console.log(
    JSON.stringify(
      {
        browser: browser.version(),
        origin,
        viewport: "412x915",
        mobile: true,
        cpu: 4,
        cards: data.cards.length,
        evaluatedAt: data.evaluatedAt,
        results,
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
