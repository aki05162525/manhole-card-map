// Production browser checks using synthetic cards; no live services.
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
try {
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(Error("Fixture server startup timed out")),
      10000,
    );
    server.once("error", reject);
    server.once("exit", (code) => {
      clearTimeout(timeout);
      reject(Error(`Server exited: ${code}`));
    });
    server.stdout.once("data", () => {
      clearTimeout(timeout);
      resolve();
    });
  });
  browser = await chromium.launch({
    ...(process.env.CHROME ? { executablePath: process.env.CHROME } : {}),
    args: ["--no-sandbox"],
  });
  const errors = [];
  const context = await browser.newContext({
    viewport: { width: 412, height: 823 },
    hasTouch: true,
    isMobile: true,
  });
  context.setDefaultTimeout(15000);
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(String(error)));
  const external = [];
  const backgroundRequests = [];
  page.on("request", (request) => {
    if (request.url().endsWith("/background/japan.geojson"))
      backgroundRequests.push(request.url());
    if (!request.url().startsWith(origin) && !request.url().startsWith("data:"))
      external.push(request.url());
  });
  await page.goto(origin);
  await page.waitForFunction(() => window.prototype?.metrics.ready > 0);
  assert.equal(await page.locator("#fixture-warning").count(), 1);
  assert.equal(backgroundRequests.length, 1, "preload must be reused by fetch");
  assert.equal(await page.locator("#cards option").count(), 6);
  assert.match(await page.locator("#notice").innerText(), /簡略図/);
  await page.locator("#search").fill("位置未確定");
  assert.equal(await page.locator("#cards option").count(), 2);
  await page.locator("#cards").selectOption("TEST-UNKNOWN");
  await page.locator("#detail h2").waitFor();
  assert.equal(
    await page.locator('#detail a[href*="google.com/maps"]').count(),
    0,
  );
  await page.locator("#detail").press("Escape");
  assert.equal(await page.locator("#detail").isVisible(), false);
  await page.locator("#search").fill("");
  await page.locator("#cards").selectOption("TEST-TOKYO-1");
  await page.locator("#detail h3").first().waitFor();
  assert.equal(await page.locator("#detail h3").count(), 2);
  const links = await page
    .locator('#detail a[href*="google.com/maps"]')
    .evaluateAll((nodes) =>
      nodes.map((n) => ({ href: n.href, text: n.textContent })),
    );
  assert.equal(links.length, 3);
  const search = links.find((l) => l.text.includes("施設名・住所で検索"));
  assert.equal(
    new URL(search.href).searchParams.get("query"),
    "合成テスト休日配布所 架空 & テスト #2",
  );
  assert.equal(
    new URL(links.find((l) => l.text.startsWith("蓋")).href).searchParams.get(
      "query",
    ),
    "35.68,139.76",
  );
  await page.getByRole("button", { name: "閉じる", exact: true }).click();
  await page.evaluate(() => window.prototype.adapter.locate(35.68, 139.76));
  await page.locator(".cluster").filter({ hasText: "3" }).first().click();
  const group = page.getByLabel("この位置・範囲のカード一覧");
  await group.waitFor();
  assert.equal(await group.locator("option").count(), 2);
  await group.selectOption("TEST-TOKYO-2");
  await group.press("Enter");
  await page.getByRole("button", { name: "一覧に戻る（2枚）" }).waitFor();
  assert.match(await page.locator("#detail h2").innerText(), /東京B/);
  await page.getByRole("button", { name: "一覧に戻る（2枚）" }).click();
  assert.equal(await group.locator("option").count(), 2);
  await page.getByRole("button", { name: "閉じる", exact: true }).click();
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("map-view")),
  );
  await page.reload();
  await page.waitForFunction(() => window.prototype?.metrics.ready > 0);
  const restored = await page.evaluate(() => window.prototype.adapter.view());
  assert.ok(Math.abs(saved.lat - restored.lat) < 0.02);
  assert.ok(Math.abs(saved.lng - restored.lng) < 0.02);
  await page.getByRole("button", { name: "現在地", exact: true }).click();
  await page.waitForFunction(() =>
    document
      .querySelector("#notice")
      .textContent.includes("現在地を取得できなかった"),
  );
  await page.waitForFunction(() =>
    document.querySelector("#offline").textContent.includes("準備完了"),
  );
  const cached = await page.evaluate(async () => {
    const names = await caches.keys();
    return (
      await Promise.all(
        names.map(async (name) =>
          (await (await caches.open(name)).keys()).map((r) => r.url),
        ),
      )
    ).flat();
  });
  assert.ok(
    !cached.some((url) => /\/(background|maps|fonts|sprites)\//.test(url)),
    "background must not enter the offline guarantee",
  );
  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.clearBrowserCache");
  await context.setOffline(true);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(
    () => document.querySelector("#cards").options.length === 6,
  );
  await page.locator("#cards").selectOption("TEST-TOKYO-1");
  await page.locator("#detail h2").waitFor();
  assert.equal(await page.locator("#detail h3").count(), 2);
  await page.waitForFunction(() => window.prototype?.metrics.errors.length > 0);
  assert.equal(await page.evaluate(() => window.prototype.metrics.ready), 0);
  assert.deepEqual(errors, []);
  assert.deepEqual(external, []);
  await context.close();
  // Selection before a slow dynamic map import must be replayed on the map.
  const slow = await browser.newContext({
    serviceWorkers: "block",
    geolocation: { latitude: 34.69, longitude: 135.5 },
    permissions: ["geolocation"],
  });
  slow.setDefaultTimeout(15000);
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  await slow.route("**/assets/simplified-*.js", async (route) => {
    await gate;
    await route.continue();
  });
  const early = await slow.newPage();
  await early.goto(origin, { waitUntil: "domcontentloaded" });
  await early.waitForFunction(
    () => document.querySelector("#cards").options.length === 6,
  );
  await early.locator("#cards").selectOption("TEST-TOKYO-1");
  await early.locator("#detail h2").waitFor();
  assert.equal(
    await early
      .getByRole("button", { name: "現在地", exact: true })
      .isDisabled(),
    true,
  );
  release();
  await early.waitForFunction(() => window.prototype?.metrics.ready > 0);
  assert.ok(
    (await early.locator(".pin.selected").count()) > 0,
    "early selection must be highlighted after map load",
  );
  await early.getByRole("button", { name: "現在地", exact: true }).click();
  await early.waitForFunction(
    () => Math.abs(window.prototype.adapter.view().lat - 34.69) < 0.01,
  );
  await slow.close();
  // Background download must overlap card download, not wait for all details.
  const prefetch = await browser.newContext({ serviceWorkers: "block" });
  prefetch.setDefaultTimeout(15000);
  let releaseData;
  const dataGate = new Promise((resolve) => {
    releaseData = resolve;
  });
  await prefetch.route("**/data/full.json", async (route) => {
    await dataGate;
    await route.continue();
  });
  const parallel = await prefetch.newPage();
  const requestedBackground = parallel
    .waitForRequest("**/background/japan.geojson", { timeout: 5000 })
    .then(
      () => true,
      () => false,
    );
  await parallel.goto(origin, { waitUntil: "domcontentloaded" });
  const overlapping = await requestedBackground;
  releaseData();
  assert.equal(
    overlapping,
    true,
    "background and cards must download concurrently",
  );
  await prefetch.close();
  const diagnostic = await browser.newPage();
  diagnostic.setDefaultTimeout(15000);
  await diagnostic.goto(`${origin}/?engine=d&benchmark`);
  await diagnostic.waitForFunction(() => window.prototype?.metrics.ready > 0);
  assert.match(
    await diagnostic.locator("#notice").innerText(),
    /診断用：背景なし/,
  );
  await diagnostic.close();
  console.log(
    "Browser checks passed: synthetic data, links, clusters, keyboard, view restore, denial, offline, diagnostic.",
  );
} finally {
  await browser?.close();
  server.kill();
}
