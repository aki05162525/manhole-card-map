// Production fixture checks: behavior and layout, not real-device FPS.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
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
const ready = (page) =>
  page.waitForFunction(() => window.prototype?.metrics.ready > 0);
const cardList = (page) =>
  page.waitForFunction(
    () => document.querySelector("#cards")?.options.length === 6,
  );
async function closeDetail(page) {
  await page.getByRole("button", { name: "閉じる", exact: true }).click();
  await page.waitForFunction(() => !document.querySelector("#detail"));
}
async function openPanel(page) {
  const toggle = page.locator(".panel-toggle");
  if (
    (await toggle.count()) &&
    (await toggle.getAttribute("aria-expanded")) === "false"
  )
    await toggle.click();
}
async function choose(page, id) {
  await openPanel(page);
  await page.locator("#cards").selectOption(id);
  await page.locator("#detail h2").waitFor();
}
async function prefecturePanel(page) {
  await openPanel(page);
  await page.getByText("都道府県から探す", { exact: true }).click();
  await page.locator(".pref-picker").getByText("関東", { exact: true }).click();
  await page
    .getByRole("button", { name: "東京都（1か所）", exact: true })
    .click();
  await openPanel(page);
  const panel = page.getByRole("region", { name: "県のカード" });
  assert.match(
    await panel.innerText(),
    /収録4枚・地図に出せる2枚・位置未確定2枚/,
  );
  assert.equal(await panel.getByRole("button").count(), 4);
  await panel.getByRole("button", { name: /TEST-UNKNOWN/ }).click();
  await page.locator("#detail h2").waitFor();
  assert.match(await page.locator("#detail h2").innerText(), /位置未確定/);
  await closeDetail(page);
}
async function stableMap(page) {
  await mkdir("results", { recursive: true });
  const before = await page.locator("#map").boundingBox();
  const viewport = await page.evaluate(() => ({
    width: innerWidth,
    height: innerHeight,
  }));
  assert.ok(
    Math.abs(before.width - viewport.width) < 1 &&
      Math.abs(before.height - viewport.height) < 1,
    "map fills viewport",
  );
  const screen = viewport.width < 600 ? "mobile" : "desktop";
  // Phones zoom with fingers: only the location control stays, at the bottom right.
  // Elsewhere it sits directly above the zoom controls.
  const locateBox = await page.locator("#locate").boundingBox();
  const zoomIn = page.getByRole("button", { name: "Zoom in", exact: true });
  if (screen === "mobile") {
    assert.equal(await zoomIn.isVisible(), false);
    assert.ok(viewport.width - (locateBox.x + locateBox.width) < 24);
    assert.ok(viewport.height - (locateBox.y + locateBox.height) < 60);
  } else {
    const zoomBox = await zoomIn.boundingBox();
    assert.ok(locateBox.y + locateBox.height <= zoomBox.y);
    assert.ok(zoomBox.y - (locateBox.y + locateBox.height) < 16);
    assert.ok(
      Math.abs(locateBox.x + locateBox.width - zoomBox.x - zoomBox.width) < 1,
    );
  }
  await page.screenshot({ path: `results/mapcn-check-${screen}.png` });
  await choose(page, "TEST-TOKYO-1");
  await page.waitForFunction(() => {
    return window.prototype.adapter.view().zoom > 14.9;
  });
  // The camera can settle before the worker renders the new tiles.
  // Wait for reachable geometry, as the geometry-click check below does.
  const visibleTarget = await page.waitForFunction(() =>
    window.prototype.adapter.tapPoint(),
  );
  assert.ok(
    await visibleTarget.jsonValue(),
    "selected geometry must remain reachable outside the detail panel",
  );
  for (const label of [
    "現在地",
    ...(screen === "mobile" ? [] : ["Zoom in", "Zoom out"]),
  ]) {
    const control = page.getByRole("button", { name: label, exact: true });
    assert.equal(
      await control.evaluate((element) => {
        const r = element.getBoundingClientRect();
        return element.contains(
          document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2),
        );
      }),
      true,
      "map controls must not be covered by detail",
    );
  }
  await page.screenshot({ path: `results/mapcn-check-${screen}-detail.png` });
  assert.deepEqual(
    await page.locator("#map").boundingBox(),
    before,
    "detail must not resize or move map",
  );
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
    "no horizontal overflow",
  );
  await closeDetail(page);
}
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
    args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
  });
  const ctx = await context();
  const page = await ctx.newPage();
  const requests = [];
  page.on("request", (request) => requests.push(request.url()));
  await page.goto(origin);
  await ready(page);
  assert.equal(await page.locator("#fixture-warning").count(), 1);
  // The national view is the default, so no button returns to it, and the
  // location control is an icon that keeps its name for assistive technology.
  assert.equal(await page.locator("#japan").count(), 0);
  assert.equal((await page.locator("#locate").innerText()).trim(), "");
  assert.equal(await page.locator("#locate svg").count(), 1);
  // A phone starts with the map uncovered; the list is one tap away.
  assert.equal(await page.locator("#search").isVisible(), false);
  // The fixture warning stays visible here, so allow for it.
  assert.ok((await page.locator(".search-panel").boundingBox()).height < 200);
  await openPanel(page);
  assert.equal(await page.locator("#search").isVisible(), true);
  await page.locator(".panel-toggle").click();
  assert.equal(await page.locator("#search").isVisible(), false);
  assert.equal(await page.locator("#cards option").count(), 6);
  assert.equal(
    await page.evaluate(() => window.prototype.metrics.engine),
    "mapcn",
  );
  assert.equal(await page.locator(".maplibregl-canvas").count(), 1);
  assert.equal(
    requests.some((url) => url.endsWith("/background/japan.geojson")),
    false,
  );
  assert.equal(await page.locator("#show-lids").isChecked(), false);
  await stableMap(page);
  await choose(page, "TEST-TOKYO-1");
  await page
    .getByText("カード配布時間：9:00–17:00（合成）", { exact: true })
    .waitFor();
  await page
    .getByRole("button", { name: "このカードの蓋を見る", exact: true })
    .click();
  await page.waitForTimeout(650);
  const lidView = await page.evaluate(() => window.prototype.adapter.view());
  await page
    .getByRole("button", { name: "配布場所を見る", exact: true })
    .click();
  await page.waitForTimeout(650);
  const placeView = await page.evaluate(() => window.prototype.adapter.view());
  assert.ok(
    Math.abs(lidView.lng - placeView.lng) > 0.01,
    "lid action changes destination",
  );
  await openPanel(page);
  await page.locator("#show-lids").check();
  await page.locator("#show-lids").uncheck();
  await page
    .getByRole("button", { name: "このカードの蓋を見る", exact: true })
    .click();
  await page.waitForTimeout(650);
  const afterToggle = await page.evaluate(() =>
    window.prototype.adapter.view(),
  );
  assert.ok(
    Math.abs(afterToggle.lng - lidView.lng) < 0.002,
    "adapter remains live after pin toggle",
  );
  await closeDetail(page);
  await choose(page, "TEST-OSAKA");
  assert.equal(
    await page
      .getByRole("button", { name: "配布場所を見る", exact: true })
      .isDisabled(),
    true,
  );
  assert.equal(
    await page
      .getByRole("button", { name: "このカードの蓋を見る", exact: true })
      .isEnabled(),
    true,
  );
  await closeDetail(page);
  await openPanel(page);
  await page.locator("#search").fill("位置未確定");
  assert.equal(await page.locator("#cards option").count(), 2);
  await page.locator("#cards").focus();
  await choose(page, "TEST-UNKNOWN");
  assert.equal(
    await page.locator('#detail a[href*="google.com/maps"]').count(),
    0,
  );
  await page.locator("#detail h2").press("Escape");
  assert.equal(await page.locator("#detail").count(), 0);
  assert.equal(
    await page
      .locator("#cards")
      .evaluate((element) => document.activeElement === element),
    true,
    "Escape restores focus",
  );
  await openPanel(page);
  await page.locator("#search").fill("");
  await choose(page, "TEST-TOKYO-1");
  assert.equal(await page.locator("#detail .facility h3").count(), 2);
  const links = await page
    .locator('#detail a[href*="google.com/maps"]')
    .evaluateAll((nodes) =>
      nodes.map((node) => ({
        href: node.href,
        text: node.textContent,
        rel: node.rel,
      })),
    );
  assert.equal(links.length, 3);
  assert.equal(
    new URL(
      links.find((link) => link.text.includes("施設名・住所で検索")).href,
    ).searchParams.get("query"),
    "合成テスト休日配布所 架空 & テスト #2",
  );
  assert.equal(
    new URL(
      links.find((link) => link.text.startsWith("蓋")).href,
    ).searchParams.get("query"),
    "35.7,139.78",
  );
  assert.ok(links.every((link) => link.rel.includes("noopener")));
  await closeDetail(page);
  // On phones the breadcrumb is a thumb target level with the location control.
  const crumbContext = await context();
  const crumbPage = await crumbContext.newPage();
  await crumbPage.goto(origin);
  await ready(crumbPage);
  await openPanel(crumbPage);
  await crumbPage.getByText("都道府県から探す", { exact: true }).click();
  await crumbPage
    .locator(".pref-picker")
    .getByText("関東", { exact: true })
    .click();
  await crumbPage.getByRole("button", { name: /^東京都（/ }).click();
  const crumbs = crumbPage.locator(".breadcrumbs");
  await crumbs.waitFor();
  const crumbBox = await crumbs.boundingBox();
  const locateBox = await crumbPage.locator("#locate").boundingBox();
  assert.ok(
    Math.abs(crumbBox.y + crumbBox.height - locateBox.y - locateBox.height) < 2,
  );
  assert.ok(crumbBox.x <= 12);
  assert.ok(crumbBox.x + crumbBox.width <= locateBox.x);
  const home = crumbs.getByRole("button", { name: "全国", exact: true });
  assert.ok((await home.boundingBox()).height >= 44);
  assert.ok(
    Number.parseFloat(
      await home.evaluate((element) => getComputedStyle(element).fontSize),
    ) >= 15,
  );
  await crumbContext.close();
  // Isolate the same-location case from earlier selection animations.
  const clusterContext = await context();
  const clusterPage = await clusterContext.newPage();
  await clusterPage.goto(origin);
  await ready(clusterPage);
  await clusterPage.evaluate(() =>
    window.prototype.adapter.locate(35.68, 139.76),
  );
  // tapPoint also finds count badges, so wait until the camera has reached the pins.
  await clusterPage.waitForFunction(
    () => Math.abs(window.prototype.adapter.view().zoom - 14) < 0.01,
  );
  // Click rendered geometry; never invoke the selection callback.
  await clusterPage.waitForFunction(
    () => window.prototype.adapter.tapPoint() !== null,
  );
  const point = await clusterPage.evaluate(() =>
    window.prototype.adapter.tapPoint(),
  );
  await clusterPage.mouse.click(point.x, point.y);
  const group = clusterPage.getByLabel("この位置・範囲のカード一覧");
  await group.waitFor();
  assert.equal(await group.locator("option").count(), 2);
  await group.selectOption("TEST-TOKYO-2");
  await group.press("Enter");
  await clusterPage
    .getByRole("button", { name: "一覧に戻る（2枚）" })
    .waitFor();
  assert.match(await clusterPage.locator("#detail h2").innerText(), /東京B/);
  await clusterPage.getByRole("button", { name: "一覧に戻る（2枚）" }).click();
  assert.equal(await group.locator("option").count(), 2);
  await closeDetail(clusterPage);
  await clusterContext.close();
  // Every visit starts from the whole country, even with a view saved by an old version.
  await page.evaluate(() => window.prototype.adapter.locate(34.69, 135.5));
  await page.waitForFunction(
    () => Math.abs(window.prototype.adapter.view().zoom - 14) < 0.01,
  );
  await page.evaluate(() =>
    localStorage.setItem(
      "map-view",
      JSON.stringify({ lat: 34.69, lng: 135.5, zoom: 14 }),
    ),
  );
  await page.reload();
  await ready(page);
  assert.ok(
    (await page.evaluate(() => window.prototype.adapter.view().zoom)) < 5,
  );
  await page.getByRole("button", { name: "現在地", exact: true }).click();
  await page.waitForFunction(() =>
    document
      .querySelector("#notice")
      .textContent.includes("現在地を取得できなかった"),
  );
  await page.waitForFunction(() =>
    document.querySelector("#offline").textContent.includes("準備完了"),
  );
  const cached = await page.evaluate(async () =>
    (
      await Promise.all(
        (await caches.keys()).map(async (name) =>
          (await (await caches.open(name)).keys()).map(
            (request) => request.url,
          ),
        ),
      )
    ).flat(),
  );
  assert.ok(
    !cached.some(
      (url) =>
        /\/(background|maps|fonts|sprites)\//.test(url) ||
        url.endsWith("/map-style.json"),
    ),
  );
  assert.ok(cached.some((url) => url.endsWith("/maplibre-gl-worker.mjs")));
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.clearBrowserCache");
  await ctx.setOffline(true);
  await page.reload({ waitUntil: "domcontentloaded" });
  await cardList(page);
  await choose(page, "TEST-TOKYO-1");
  assert.equal(await page.locator("#detail .facility h3").count(), 2);
  await page.waitForFunction(() => window.prototype.metrics.errors.length > 0);
  assert.equal(await page.evaluate(() => window.prototype.metrics.ready), 0);
  await ctx.close();
  // A prefecture chosen before the map is ready still moves the camera there.
  {
    const earlyFocus = await context({ serviceWorkers: "block" });
    let releaseFocus;
    const focusGate = new Promise((resolve) => {
      releaseFocus = resolve;
    });
    await earlyFocus.route("**/assets/card-map-*.js", async (route) => {
      await focusGate;
      await route.continue();
    });
    const focusPage = await earlyFocus.newPage();
    await focusPage.goto(origin, { waitUntil: "domcontentloaded" });
    await cardList(focusPage);
    await openPanel(focusPage);
    await focusPage.getByText("都道府県から探す", { exact: true }).click();
    await focusPage
      .locator(".pref-picker")
      .getByText("近畿", { exact: true })
      .click();
    await focusPage.getByRole("button", { name: /^大阪府（/ }).click();
    assert.equal(await focusPage.locator("#search").isVisible(), false);
    releaseFocus();
    await ready(focusPage);
    await focusPage.waitForFunction(() => {
      const view = window.prototype.adapter.view();
      return (
        Math.abs(view.lng - 135.5) < 0.6 &&
        Math.abs(view.lat - 34.6) < 0.6 &&
        view.zoom > 7
      );
    });
    await earlyFocus.close();
  }
  // Delayed map module: accessible list first, replay initial selection later.
  const slow = await context({
    serviceWorkers: "block",
    geolocation: { latitude: 34.69, longitude: 135.5 },
    permissions: ["geolocation"],
  });
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  await slow.route("**/assets/card-map-*.js", async (route) => {
    await gate;
    await route.continue();
  });
  const early = await slow.newPage();
  await early.goto(origin, { waitUntil: "domcontentloaded" });
  await cardList(early);
  await choose(early, "TEST-TOKYO-1");
  assert.equal(await early.locator("#locate").isDisabled(), true);
  release();
  await ready(early);
  await early.waitForFunction(() => {
    const view = window.prototype.adapter.view();
    return view.zoom > 13 && Math.abs(view.lng - 139.76) < 0.02;
  });
  await closeDetail(early);
  await early.locator("#locate").click();
  await early.waitForFunction(
    () => Math.abs(window.prototype.adapter.view().lat - 34.69) < 0.01,
  );
  await slow.close();
  const desktop = await context({
    reducedMotion: "reduce",
    viewport: { width: 1440, height: 900 },
    isMobile: false,
    hasTouch: false,
    serviceWorkers: "block",
  });
  const wide = await desktop.newPage();
  await wide.goto(`${origin}/?data=split`);
  await ready(wide);

  async function tap(id) {
    // Separate gestures so MapLibre does not interpret drilldown as a double click.
    await wide.waitForTimeout(600);
    await wide.waitForFunction(
      (id) => window.prototype.adapter.tapPoint(id),
      id,
    );
    const point = await wide.evaluate(
      (id) => window.prototype.adapter.tapPoint(id),
      id,
    );
    const box = await wide.locator("#map").boundingBox();
    await wide.mouse.click(box.x + point.x, box.y + point.y);
  }
  await wide.setViewportSize({ width: 800, height: 823 });
  await tap("kanto");
  await wide
    .locator(".breadcrumbs")
    .getByText("関東", { exact: true })
    .waitFor();
  await tap("東京都");
  await wide
    .locator(".breadcrumbs")
    .getByText("東京都", { exact: true })
    .waitFor();
  await wide.waitForFunction(() => {
    const v = window.prototype.adapter.view();
    return v.lng > 138 && v.lng < 141 && v.lat > 34 && v.lat < 37 && v.zoom > 6;
  });
  await tap("test-shared");
  await wide.locator("#detail h2").waitFor();
  await closeDetail(wide);
  await wide.goBack();
  await wide.waitForFunction(
    () =>
      !document.querySelector(".breadcrumbs")?.textContent.includes("東京都"),
  );
  assert.match(await wide.locator(".breadcrumbs").innerText(), /関東/);
  await wide.goBack();
  await wide.waitForFunction(() => !document.querySelector(".breadcrumbs"));
  await prefecturePanel(wide);
  await wide.goBack();
  await wide.waitForFunction(() => !document.querySelector(".breadcrumbs"));
  assert.equal(new URL(wide.url()).origin, origin);
  await wide
    .getByRole("button", { name: "神奈川県（0か所）", exact: true })
    .click();
  await wide.evaluate(() => window.prototype.adapter.locate(35.6801, 139.7601));
  await wide.waitForFunction(
    () =>
      window.prototype.adapter.view().zoom >= 7 &&
      window.prototype.adapter.tapPoint("test-shared"),
  );
  assert.match(await wide.locator(".breadcrumbs").innerText(), /神奈川県/);
  await wide
    .locator(".breadcrumbs")
    .getByRole("button", { name: "全国", exact: true })
    .click();
  await wide.waitForFunction(() => !document.querySelector(".breadcrumbs"));
  // Zooming out by hand returns from pins to numbers, one level at a time.
  await wide.setViewportSize({ width: 1100, height: 823 });
  await tap("kanto");
  await tap("東京都");
  await wide.waitForFunction(
    () =>
      window.prototype.adapter.view().zoom >= 7 &&
      window.prototype.adapter.tapPoint("test-shared"),
  );
  const zoomOutUntil = async (done) => {
    for (let i = 0; i < 12 && !(await wide.evaluate(done)); i++) {
      await wide.getByRole("button", { name: "Zoom out" }).click();
      await wide.waitForTimeout(350);
    }
    assert.equal(await wide.evaluate(done), true);
  };
  await zoomOutUntil(
    () =>
      !document.querySelector(".breadcrumbs")?.textContent.includes("東京都"),
  );
  assert.ok(
    (await wide.evaluate(() => window.prototype.adapter.view().zoom)) < 7,
  );
  assert.match(await wide.locator(".breadcrumbs").innerText(), /関東/);
  assert.equal(
    await wide.evaluate(() => window.prototype.adapter.tapPoint("test-shared")),
    null,
  );
  await zoomOutUntil(() => !document.querySelector(".breadcrumbs"));
  assert.ok(
    (await wide.evaluate(() => window.prototype.adapter.view().zoom)) < 5.6,
  );
  await wide.setViewportSize({ width: 1440, height: 900 });
  await stableMap(wide);
  await desktop.close();
  // WebGL unavailable: list, detail and outbound links remain usable.
  const failed = await context({ serviceWorkers: "block" }, true);
  await failed.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (kind, ...args) {
      if (["webgl", "webgl2", "experimental-webgl"].includes(kind)) return null;
      return original.call(this, kind, ...args);
    };
  });
  const fallback = await failed.newPage();
  await fallback.goto(origin);
  await cardList(fallback);
  await fallback.waitForFunction(() =>
    document.querySelector("#notice").textContent.includes("一覧・検索から"),
  );
  await prefecturePanel(fallback);
  await choose(fallback, "TEST-TOKYO-1");
  assert.equal(
    await fallback.locator('#detail a[href*="google.com/maps"]').count(),
    3,
  );
  assert.equal(await fallback.locator("#locate").isDisabled(), true);
  await failed.close();
  assert.deepEqual(errors, []);
  assert.deepEqual(external, []);
  console.log(
    "Browser checks passed: mapcn, geometry clicks, grouped cards, links, focus, restore, geolocation, offline, early selection, stable mobile/desktop viewport, WebGL fallback.",
  );
} finally {
  await browser?.close();
  server.kill();
}
