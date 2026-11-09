// Run against an existing real-data server; evidence is deliberately outside Git.
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "../../web/node_modules/playwright/index.mjs";

const origin = process.env.REAL_DATA_ORIGIN || "http://127.0.0.1:4180";
const output = process.env.SHEET_RESULTS || "/tmp/sheet-motion";
const times = [0, 50, 100, 150, 200, 250, 300, 400];
const ids = ["12-409-A001", "01-226-A001", "22-206-A001"];
const data = await (await fetch(`${origin}/data/full.json`)).json();
assert.ok(!data.fixture && ids.every((id) => data.cards.some((c) => c.id === id)));
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ args: ["--enable-unsafe-swiftshader"] });
const results = {
  chromium: browser.version(),
  origin,
  evaluatedAt: data.evaluatedAt,
  viewport: [412, 915],
  cpu: 4,
  cases: [],
};
try {
  const context = await browser.newContext({
    viewport: { width: 412, height: 915 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  const screenshots = [];
  await page.exposeBinding("captureSheetFrame", (_, label) => {
    const capture = cdp
      .send("Page.captureScreenshot", { format: "png" })
      .then(({ data: png }) => writeFile(`${output}/${label}.png`, Buffer.from(png, "base64")));
    screenshots.push(capture);
  });
  async function load(id) {
    await page.goto(`${origin}/?card=${id}`);
    await page.locator(".sheet-action-bar .sheet-more").waitFor();
    await page.evaluate(() => document.fonts.ready);
    await page.waitForFunction(() => window.prototype?.metrics.ready > 0, null, { timeout: 30000 });
    await page.waitForTimeout(500);
  }
  async function measure(label, trigger, target) {
    await page.evaluate(
      ({ times, label }) => {
        const panel = document.querySelector("#detail");
        const summary = panel.querySelector(".sheet-summary");
        const nodes = {
          title: summary.querySelector(".facility-heading h3"),
          status: summary.querySelector(".status-chip"),
          hours: summary.querySelector(".distribution-hours"),
        };
        const read = () => {
          const sheet = panel.getBoundingClientRect();
          const bar = document.querySelector(".sheet-action-bar").getBoundingClientRect();
          return {
            sheetTop: sheet.top,
            barTop: bar.top,
            barHeight: bar.height,
            nodes: Object.fromEntries(
              Object.entries(nodes).map(([key, el]) => {
                const r = el.getBoundingClientRect();
                return [
                  key,
                  {
                    x: r.left - sheet.left,
                    y: r.top - sheet.top,
                    width: r.width,
                    height: r.height,
                  },
                ];
              }),
            ),
          };
        };
        window.sheetRead = read;
        window.sheetFrames = [];
        window.startSheetFrames = () => {
          const start = performance.now();
          for (const ms of times) {
            const sample = () => {
              window.sheetFrames.push({ ms, elapsed: performance.now() - start, ...read() });
              window.captureSheetFrame(`${label}-${ms}`);
            };
            if (ms === 0) sample();
            else setTimeout(sample, ms);
          }
        };
        window.sheetBefore = read();
      },
      { times, label },
    );
    await trigger();
    await page.waitForFunction(() => window.sheetFrames.length === 8);
    await page.waitForFunction(
      (target) => document.querySelector("#detail").classList.contains(`has-${target}-layout`),
      target,
    );
    await page.waitForTimeout(100);
    const frames = await page.evaluate(() => [
      ...window.sheetFrames,
      { ms: "settled", ...window.sheetRead() },
    ]);
    const baseline = await page.evaluate(() => window.sheetBefore);
    results.cases.push({ label, baseline, frames });
    await writeFile(`${output}/measurements.json`, JSON.stringify(results, null, 2));
    for (const frame of frames) {
      assert.equal(frame.barTop, baseline.barTop, `${label}/${frame.ms}: bar top`);
      assert.equal(frame.barHeight, baseline.barHeight, `${label}/${frame.ms}: bar height`);
      for (const key of Object.keys(baseline.nodes)) {
        for (const dimension of ["x", "y", "width", "height"]) {
          assert.ok(
            Math.abs(frame.nodes[key][dimension] - baseline.nodes[key][dimension]) < 0.01,
            `${label}/${frame.ms}: ${key}.${dimension} ${frame.nodes[key][dimension]} != ${baseline.nodes[key][dimension]}`,
          );
        }
      }
    }
    await Promise.all(screenshots.splice(0));
    console.log(`${label}: bar=${baseline.barTop}, all relative rect deltas <0.01px`);
  }
  async function swipe(up) {
    const y = await page
      .locator(".sheet-summary")
      .evaluate((el) => el.getBoundingClientRect().top + 12);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: 180, y }],
    });
    for (let step = 1; step <= 4; step++) {
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x: 180, y: y + (up ? -1 : 1) * step * 30 }],
      });
      const during = await page.evaluate(() => ({
        before: window.sheetBefore,
        frame: window.sheetRead(),
      }));
      assert.equal(during.frame.barTop, during.before.barTop);
      for (const key of Object.keys(during.before.nodes)) {
        for (const dimension of ["x", "y", "width", "height"])
          assert.ok(
            Math.abs(during.frame.nodes[key][dimension] - during.before.nodes[key][dimension]) <
              0.01,
          );
      }
      await page.waitForTimeout(15);
    }
    await page.evaluate(() => window.startSheetFrames());
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  }
  for (const id of ids) {
    for (const method of ["click", "touch"]) {
      await load(id);
      await measure(
        `${id}-${method}-expand`,
        async () => {
          if (method === "touch") await swipe(true);
          else
            await page.locator(".sheet-action-bar .sheet-more").evaluate((el) => {
              window.startSheetFrames();
              el.click();
            });
        },
        "full",
      );
      await measure(
        `${id}-${method}-contract`,
        async () => {
          if (method === "touch") await swipe(false);
          else
            await page.locator(".sheet-back").evaluate((el) => {
              window.startSheetFrames();
              el.click();
            });
        },
        "summary",
      );
    }
  }
  await page.emulateMedia({ colorScheme: "dark" });
  await load(ids[0]);
  await page.screenshot({ path: `${output}/dark-summary.png` });
  await page.locator(".sheet-more").click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${output}/dark-full.png` });
  await page.emulateMedia({ colorScheme: "light" });
  await load(ids[0]);
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "200%";
  });
  await page.waitForTimeout(500);
  const enlargedBar = await page.locator(".sheet-action-bar").boundingBox();
  assert.equal(await page.locator("#detail[data-sheet-compact]").count(), 1);
  await page.locator(".sheet-more").click();
  await page.waitForTimeout(500);
  assert.deepEqual(await page.locator(".sheet-action-bar").boundingBox(), enlargedBar);
  assert.equal(await page.locator(".summary-support").isVisible(), true);
  assert.match(await page.locator(".summary-support").innerText(), new RegExp(data.evaluatedAt));
  assert.equal(
    await page.evaluate(() => document.activeElement.matches("#detail h2, #detail h3")),
    true,
  );
  await page.screenshot({ path: `${output}/text-200-full.png` });
  console.log(
    `200% text: stable action bar ${JSON.stringify(enlargedBar)}; supporting details and heading focus present`,
  );
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "";
  });
  for (const [width, height] of [
    [1440, 900],
    [1001, 915],
    [915, 412],
  ]) {
    await page.setViewportSize({ width, height });
    await page.goto(`${origin}/?card=${ids[0]}`);
    await page.locator(".detail-destinations").waitFor();
    assert.equal(await page.locator(".sheet-action-bar").count(), 0);
    assert.equal(
      await page.locator("#detail").evaluate((el) => getComputedStyle(el).transform),
      "none",
    );
  }
  await writeFile(`${output}/measurements.json`, JSON.stringify(results, null, 2));
  console.log(
    `PASS: ${results.cases.length} transitions, 96 timed captures; desktop/short-landscape unchanged panel mode; ${output}`,
  );
} finally {
  await browser.close();
}
