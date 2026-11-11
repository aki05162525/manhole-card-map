// SPIKE(keep-map-alive): confirm CDP CPU/network throttling survives a link navigation.
import { chromium } from "playwright";
const origin = process.env.ORIGIN;
const browser = await chromium.launch({
  args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
});
const context = await browser.newContext({
  viewport: { width: 412, height: 915 },
  isMobile: true,
  hasTouch: true,
});
const page = await context.newPage();
const busy = () =>
  page.evaluate(() => {
    const t = performance.now();
    let x = 0;
    for (let i = 0; i < 3e7; i++) x += i % 7;
    return Math.round(performance.now() - t);
  });
const ttfb = () =>
  page.evaluate(async () => {
    const t = performance.now();
    await (await fetch("/cards", { cache: "no-store" })).text();
    return Math.round(performance.now() - t);
  });
await page.goto(`${origin}/cards`);
console.log("unthrottled busy", await busy(), "ttfb", await ttfb());
const cdp = await context.newCDPSession(page);
await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
await cdp.send("Network.enable");
await cdp.send("Network.emulateNetworkConditions", {
  offline: false,
  latency: 150,
  downloadThroughput: 200000,
  uploadThroughput: 93750,
});
console.log("throttled busy", await busy());
await page.click(".site-header .site-menu-button");
await page.click('.site-header .site-menu-panel a[href="/"]');
await page.waitForURL(`${origin}/`);
await page.waitForLoadState("domcontentloaded");
console.log("after link nav busy", await busy(), "ttfb", await ttfb());
await browser.close();
