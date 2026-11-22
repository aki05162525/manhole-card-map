// Production fixture checks: behavior and layout, not real-device FPS.
import { enableMapDiagnostics } from "./enable-map-diagnostics.mjs";
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
const server = spawn(process.execPath, ["scripts/deploy/serve.mjs"], {
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
  const cardContext = await context();
  const cardPage = await cardContext.newPage();
  await cardPage.goto(`${origin}/card/TEST-TOKYO-1/`);
  const counters = cardPage.locator(".card-places > section");
  assert.equal(await counters.count(), 2);
  const holidayHours = counters.last().locator("dd").first();
  await holidayHours.evaluate((value) => {
    value.textContent +=
      "\n休日は閉館時刻の三十分前まで。祝日の翌日は窓口の休館日にご注意ください。";
  });
  for (const width of [1024, 375, 320]) {
    await cardPage.setViewportSize({ width, height: 823 });
    const lines = await holidayHours.evaluate((value) => {
      const range = document.createRange();
      range.selectNodeContents(value);
      return [...range.getClientRects()].map((line) => line.right);
    });
    assert.ok(lines.every((right) => right <= width));
    if (width === 320) assert.ok(lines.length > 2);
    for (const counter of await counters.all()) {
      const heading = await counter.locator("h3").boundingBox();
      for (const term of await counter.locator("dt").all()) {
        const label = await term.boundingBox();
        const value = await term
          .locator("xpath=following-sibling::dd[1]")
          .boundingBox();
        assert.ok(
          Math.abs(label.x - heading.x) < 1,
          `施設名と${await term.textContent()}の左端 (${width}px)`,
        );
        assert.ok(Math.abs(value.x - label.x) < 1);
        assert.ok(
          value.y >= label.y + label.height - 1 &&
            value.y - (label.y + label.height) <= 8,
        );
        assert.ok(value.x + value.width <= width);
      }
    }
  }
  await cardContext.close();
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
    await enableMapDiagnostics(ctx);
    const page = await ctx.newPage();
    await page.goto(origin);
    await page.waitForFunction(() => window.mapDiagnostics?.metrics.ready > 0);
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
    await page.locator("#detail h2.detail-title").waitFor();
    await page.waitForFunction(
      () => window.mapDiagnostics.adapter.tapPoint("test-shared") !== null,
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
    await page.locator("#detail h2.detail-title").waitFor();
    await page.getByRole("button", { name: "閉じる", exact: true }).click();
    await page.locator("#detail").waitFor({ state: "detached" });
    await page.goto(`${origin}/?card=${selectedId}`);
    await page.locator("#detail h2.detail-title").waitFor();
    await page.getByRole("button", { name: "閉じる", exact: true }).click();
    await page.waitForURL(origin + "/");
    await page.locator("#detail").waitFor({ state: "detached" });
    await page.goto(origin);
    await page.waitForFunction(() => window.mapDiagnostics?.metrics.ready > 0);
    const nationwide = await page.evaluate(() =>
      window.mapDiagnostics.adapter.view(),
    );
    await page
      .getByRole("button", { name: "カードを検索", exact: true })
      .click();
    await page.getByRole("searchbox").fill("TEST-UNKNOWN");
    await page.locator(".map-search-results button").first().click();
    await page.locator("#detail h2.detail-title").waitFor();
    assert.deepEqual(
      await page.evaluate(() => window.mapDiagnostics.adapter.view()),
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
    await page.waitForFunction(() =>
      document.activeElement?.matches("#detail h2"),
    );
    assert.equal(
      await page.evaluate(() => Object.hasOwn(window, "mapDiagnostics")),
      false,
    );
    await page.locator("#locate:enabled").waitFor();
    assert.equal(
      await page.evaluate(() =>
        performance
          .getEntriesByType("resource")
          .some(({ name }) =>
            new URL(name).pathname.includes("/map-diagnostics-"),
          ),
      ),
      false,
    );
    assert.equal(
      await page.evaluate(
        () => performance.getEntriesByName("pin-to-detail").length,
      ),
      0,
    );
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
    // A prefecture in focus, as after choosing it on the map.
    await page.evaluate(() => {
      history.replaceState(
        { ...history.state, mapFocus: { area: "kanto", pref: "神奈川県" } },
        "",
      );
      window.dispatchEvent(
        new PopStateEvent("popstate", { state: history.state }),
      );
    });
    await page.getByRole("navigation", { name: "地図の移動" }).waitFor();
    console.log(
      `Breadcrumbs ${scaled ? "200%" : "100%"}:`,
      await page.evaluate(`${sheetGeometry}; checkBreadcrumbs()`),
    );
    // A touch on the map folds the sheet away.
    await page.touchscreen.tap(100, 420);
    await page.locator("#detail.is-collapsed").waitFor();
    await page.waitForFunction(
      () =>
        document.querySelector("#detail").getBoundingClientRect().top >
        innerHeight / 2,
    );
    console.log(
      `Collapsed sheet ${scaled ? "200%" : "100%"}:`,
      await page.evaluate(`${sheetGeometry}; checkCollapsedSheet()`),
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
  await page.locator("#detail h2.detail-title").waitFor();
  await failed.close();
  const webgl = await context({}, true);
  await webgl.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (kind, ...args) {
      if (kind.startsWith("webgl")) return null;
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
  await webglPage.locator("#detail h2.detail-title").waitFor();
  await webglPage
    .getByRole("button", { name: "カードを検索", exact: true })
    .click();
  await webglPage.getByRole("searchbox").fill("TEST-TOKYO-1");
  await webglPage.locator(".map-search-results button").first().click();
  await webglPage
    .locator("#detail h2.detail-title")
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
