// Production fixture checks: behavior and layout, not real-device FPS.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { checkCardsPage } from "./cards-page.browser-check.mjs";
import { readFile } from "node:fs/promises";
const sheetGeometry = (
  await readFile(
    new URL("./detail-sheet-geometry.mjs", import.meta.url),
    "utf8",
  )
).replaceAll("export function", "function");
import { chromium } from "playwright";
const port = process.env.PORT || "4179";
const origin = `http://127.0.0.1:${port}`;
// Refuse an occupied port before starting our own server.
const probe = createServer();
await new Promise((resolve, reject) => {
  probe.once("error", reject);
  probe.listen(Number(port), "127.0.0.1", resolve);
});
await new Promise((resolve) => probe.close(resolve));
console.log(`Test server: ${origin}`);
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
    server.on("exit", (code) => reject(new Error(`Server exited: ${code}`)));
  });
  browser = await chromium.launch({ headless: true });
  for (const [width, height] of [
    [412, 823],
    [1280, 823],
    [823, 412],
  ]) {
    console.log(`Map browser: ${width}x${height}`);
    const ctx = await context({
      viewport: { width, height },
      reducedMotion: "reduce",
    });
    const page = await ctx.newPage();
    await page.goto(origin);
    await page.waitForFunction(() => window.prototype?.metrics.ready > 0);
    await page.getByRole("link", { name: "このサイトについて" }).waitFor();
    const search = page.getByRole("searchbox");
    await page
      .getByRole("button", { name: "カードを検索", exact: true })
      .waitFor();
    assert.equal(await page.locator(".map-search-results:visible").count(), 0);
    await page.getByText("検証用の架空データ", { exact: false }).waitFor();
    assert.equal(await page.locator(".maplibregl-canvas").count(), 1);
    await page
      .getByRole("button", { name: "カードを検索", exact: true })
      .click();
    await search.fill("絶対に存在しない自治体");
    const searchResults = page.locator(".map-search-results");
    await searchResults
      .getByRole("heading", {
        name: "『絶対に存在しない自治体』に一致するカードはありません",
        exact: true,
      })
      .waitFor();
    assert.equal(await searchResults.locator("[data-card]").count(), 0);
    await searchResults
      .getByText("漢字の自治体名・施設名・県名・番号の一部で探せます", {
        exact: true,
      })
      .waitFor();
    await searchResults.getByRole("link", { name: "地域から探す" }).waitFor();
    await search.fill("TEST-TOKYO-1");
    await page.locator(".map-search-results button").first().waitFor();
    await page.evaluate(() =>
      history.replaceState(
        { ...history.state, mapFocus: { area: "kanto", pref: "東京都" } },
        "",
      ),
    );
    await page.locator(".map-search-results button").first().click();
    await page.locator("#detail .detail-heading h2").waitFor();
    await page.waitForFunction(
      () => window.prototype.adapter.tapPoint("test-shared") !== null,
    );
    const selectedId = new URL(page.url()).searchParams.get("card");
    assert.ok(selectedId);
    assert.deepEqual(await page.evaluate(() => history.state.mapFocus), {
      area: "kanto",
      pref: "東京都",
    });
    await searchResults.waitFor({ state: "hidden" });
    assert.equal(await page.locator(".map-search-results:visible").count(), 0);
    await page.goBack();
    await page.locator("#detail").waitFor({ state: "detached" });
    await page.goForward();
    await page.locator("#detail .detail-heading h2").waitFor();
    await page.getByRole("button", { name: "閉じる", exact: true }).click();
    await page.locator("#detail").waitFor({ state: "detached" });
    await page.goto(`${origin}/?card=${selectedId}`);
    await page.locator("#detail .detail-heading h2").waitFor();
    await page.getByRole("button", { name: "閉じる", exact: true }).click();
    await page.waitForURL(origin + "/");
    await page.locator("#detail").waitFor({ state: "detached" });
    await page.goto(origin);
    await page.waitForFunction(() => window.prototype?.metrics.ready > 0);
    const nationwide = await page.evaluate(() =>
      window.prototype.adapter.view(),
    );
    await page
      .getByRole("button", { name: "カードを検索", exact: true })
      .click();
    await page.getByRole("searchbox").fill("TEST-UNKNOWN");
    await page.locator(".map-search-results button").first().click();
    await page.locator("#detail .detail-heading h2").waitFor();
    assert.deepEqual(
      await page.evaluate(() => window.prototype.adapter.view()),
      nationwide,
    );
    await page.goto(`${origin}/?card=missing`);
    await page.getByRole("button", { name: "カード指定を解除" }).click();
    await page.waitForURL(origin + "/");
    await page.evaluate(() => {
      history.replaceState(
        { ...history.state, mapFocus: { area: "kanto", pref: "東京都" } },
        "",
      );
      window.dispatchEvent(
        new PopStateEvent("popstate", { state: history.state }),
      );
    });
    await page.getByRole("button", { name: "メニュー" }).click();
    await page
      .getByRole("link", { name: "一覧", exact: true })
      .and(page.locator('[href="/cards?pref=13"]'))
      .waitFor();
    await ctx.close();
  }
  for (const scaled of [false, true]) {
    const ctx = await context({
      viewport: { width: 412, height: 915 },
      reducedMotion: "reduce",
    });
    const page = await ctx.newPage();
    if (scaled) {
      const cdp = await ctx.newCDPSession(page);
      await cdp.send("Page.setFontSizes", { fontSizes: { standard: 32 } });
    }
    await page.goto(`${origin}/?card=TEST-TOKYO-1`);
    await page.locator("#detail.is-summary").waitFor();
    await page.locator("#sheet-action-bar .summary-actions").waitFor();
    await page.evaluate(() => document.fonts.ready);
    await page.waitForFunction(
      () =>
        !document
          .getAnimations()
          .some(
            (a) =>
              a.playState === "running" &&
              a.effect?.getComputedTiming().iterations !== Infinity,
          ),
    );
    console.log(
      `Summary sheet ${scaled ? "200%" : "100%"}:`,
      await page.evaluate(
        `${sheetGeometry}; checkSummarySheet({ scaled: ${scaled} })`,
      ),
    );
    await ctx.close();
  }
  const failed = await context({}, true);
  await failed.route("**/assets/card-map-*.js", (route) => route.abort());
  const page = await failed.newPage();
  await page.goto(origin);
  await page
    .getByText("背景地図を読み込めませんでした。検索と一覧は使えます。", {
      exact: true,
    })
    .waitFor();
  await page.getByRole("button", { name: "カードを検索", exact: true }).click();
  await page.getByRole("searchbox").fill("TEST-TOKYO-1");
  await page.locator(".map-search-results button").first().click();
  await page.locator("#detail .detail-heading h2").waitFor();
  await failed.close();
  const webgl = await context({}, true);
  await webgl.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (kind, ...args) {
      if (String(kind).startsWith("webgl")) return null;
      return original.call(this, kind, ...args);
    };
  });
  const webglPage = await webgl.newPage();
  await webglPage.goto(`${origin}/?card=TEST-UNKNOWN`);
  await webglPage
    .getByText("背景地図を読み込めませんでした。検索と一覧は使えます。", {
      exact: true,
    })
    .waitFor();
  await webglPage.locator("#detail .detail-heading h2").waitFor();
  await webglPage
    .getByRole("button", { name: "カードを検索", exact: true })
    .click();
  await webglPage.getByRole("searchbox").fill("TEST-TOKYO-1");
  await webglPage.locator(".map-search-results button").first().click();
  await webglPage
    .locator("#detail .detail-heading h2")
    .filter({ hasText: "東京A" })
    .waitFor();
  await webgl.close();
  await checkCardsPage(browser, origin);
  assert.deepEqual(errors, []);
  console.log(
    "Catalog connection, URL history, map failure and fixture browser checks passed",
  );
} finally {
  await browser?.close();
  const stopped = once(server, "exit");
  server.kill();
  await stopped;
}
