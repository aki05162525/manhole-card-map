// Production fixture checks: behavior and layout, not real-device FPS.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { chromium } from "playwright";
const port = process.env.PORT || "4179";
const origin = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ["scripts/serve.mjs"], {
  env: { ...process.env, PORT: port, SERVE_DIR: "dist-fixture" },
  stdio: ["ignore", "pipe", "inherit"],
});
let browser;
const errors = [],
  external = [];
async function context(options = {}, expectedFailure = false) {
  const ctx = await browser.newContext({
    viewport: { width: 412, height: 823 },
    hasTouch: true,
    isMobile: true,
    ...options,
  });
  ctx.setDefaultTimeout(20000);
  await ctx.route("**/*", (route) => {
    const url = route.request().url();
    if (!url.startsWith(origin) && !/^(data|blob):/.test(url)) {
      external.push(url);
      return route.abort();
    }
    return route.continue();
  });
  ctx.on("page", (page) => {
    if (!expectedFailure)
      page.on("pageerror", (error) => errors.push(String(error)));
  });
  return ctx;
}

try {
  await new Promise((resolve, reject) => {
    server.stdout.on("data", resolve);
    server.on("error", reject);
  });
  browser = await chromium.launch({ headless: true });
  for (const width of [412, 1280]) {
    const ctx = await context({ viewport: { width, height: 823 } });
    const page = await ctx.newPage();
    await page.goto(origin);
    await page.waitForFunction(() => window.prototype?.metrics.ready > 0);
    await page.getByRole("link", { name: "アバウト" }).waitFor();
    assert.equal(
      await page
        .locator(".search-panel, #search, #cards, .panel-toggle")
        .count(),
      0,
    );
    assert.equal(await page.locator(".maplibregl-canvas").count(), 1);
    const header = await page.locator(".brand-header").boundingBox();
    assert.ok(header.width < width && header.height < 100);
    if (width <= 1000) {
      await page.locator(".explorer").evaluate((root) => {
        const panel = document.createElement("section");
        panel.className = "detail-panel";
        panel.innerHTML =
          "<h2>カード詳細</h2><p>配布施設</p><button>蓋の位置へ</button>";
        root.append(panel);
      });
      const panel = await page.locator(".detail-panel").boundingBox();
      assert.ok(
        panel.y >= header.y + header.height,
        "panel clears brand header",
      );
      assert.ok(panel.height < 250, "short content does not stretch panel");
    }
    await ctx.close();
  }
  assert.deepEqual(errors, []);
  console.log("Minimal header and map browser checks passed");
} finally {
  await browser?.close();
  server.kill();
}
