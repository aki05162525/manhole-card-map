// SPIKE(keep-map-alive): does each in-document catalog show refetch card data?
import { chromium } from "playwright";
const origin = process.env.ORIGIN;
const browser = await chromium.launch({
  args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
});
const page = await (
  await browser.newContext({
    viewport: { width: 412, height: 915 },
    isMobile: true,
    hasTouch: true,
  })
).newPage();
await page.goto(`${origin}/`);
await page.waitForFunction(() => window.prototype?.metrics?.ready > 0);
const count = () =>
  page.evaluate(() =>
    performance
      .getEntriesByType("resource")
      .filter((e) => /\/data(-v)?\//.test(e.name))
      .map((e) => e.name.replace(location.origin, "")),
  );
console.log("map loaded", await count());
for (let i = 0; i < 3; i++) {
  await page.click(".map-search-bar .site-menu-button");
  await page.click('.map-search-bar .site-menu-panel a[href^="/cards"]');
  await page
    .locator("#cards-root .catalog-regions button[data-pref]")
    .first()
    .waitFor();
  await page.goBack();
  await page.waitForFunction(() => !document.getElementById("cards-root"));
  console.log(`after trip ${i + 1}`, (await count()).length);
}
await browser.close();
