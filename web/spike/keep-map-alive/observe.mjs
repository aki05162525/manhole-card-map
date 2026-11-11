// SPIKE(keep-map-alive): walk history across the in-document switch and log
// what the map's own history hooks do. Unthrottled.
// ORIGIN=http://127.0.0.1:4291 node spike/keep-map-alive/observe.mjs
import { chromium } from "playwright";

const origin = process.env.ORIGIN;
const browser = await chromium.launch({
  args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
});
const context = await browser.newContext({
  viewport: { width: 412, height: 915 },
  isMobile: true,
  hasTouch: true,
  deviceScaleFactor: 1.75,
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
const state = async (step) => {
  await page.waitForTimeout(1500);
  const s = await page.evaluate(() => {
    const map = window.__spikeMap;
    const panel = document.querySelector(".detail-panel");
    return {
      url: location.pathname + location.search,
      state: JSON.stringify(history.state)?.slice(0, 160),
      historyLength: history.length,
      mapHidden: document.getElementById("root").hidden,
      cards: !!document.getElementById("cards-root"),
      detail: panel ? panel.getAttribute("class") : null,
      detailTitle: panel?.querySelector("h2")?.textContent ?? null,
      hasDetailClass: document
        .querySelector(".explorer")
        ?.classList.contains("has-detail"),
      center: map
        ?.getCenter()
        .toArray()
        .map((v) => +v.toFixed(3)),
      zoom: map && +map.getZoom().toFixed(2),
      creates: window.__spikeMapCreates,
      openPopovers: document.querySelectorAll(":popover-open").length,
      dialogOpen: !!document.querySelector("dialog[open]"),
      title: document.title.slice(0, 12),
      focus: document.activeElement?.outerHTML.slice(0, 80),
    };
  });
  console.log(step, JSON.stringify(s));
};
const toCards = async () => {
  await page.click(".map-search-bar .site-menu-button");
  await page.click('.map-search-bar .site-menu-panel a[href^="/cards"]');
  await page.waitForSelector("#cards-root .catalog-regions button[data-pref]");
};
const ready = () =>
  page.waitForFunction(() => window.prototype?.metrics?.ready > 0, null, {
    timeout: 60000,
  });

// A: a card detail is open on the map.
await page.goto(`${origin}/?card=01-226-A001`);
await ready();
await state("A0 map with card");
await toCards();
await state("A1 cards");
await page.click('.catalog-regions button[data-pref="13"]');
await state("A2 cards pref (pushState in cards)");
await page.goBack();
await state("A3 back within cards");
await page.goBack();
await state("A4 back to map");
await page.goForward();
await state("A5 forward to cards");
await page.goBack();
await state("A6 back to map again");

// B: map focus changed by its own pushState, then link round trip.
await page.goto(`${origin}/`);
await ready();
await page
  .evaluate(() => {
    const btn = window.prototype.adapter.tapPoint("kanto");
    return btn;
  })
  .then(async (point) => {
    if (point) await page.mouse.click(point.x, point.y);
  });
await state("B0 map focused on kanto");
await toCards();
await state("B1 cards");
await page.click(".site-header .site-menu-button");
await page.click('.site-header .site-menu-panel a[href="/"]');
await state("B2 link back to map");
await page.goBack();
await state("B3 history back (to cards entry)");
await page.goBack();
await state("B4 history back (to kanto entry)");
await page.goBack();
await state("B5 history back (national)");

console.log("errors", errors);
await browser.close();
