import { chromium } from "playwright";
const browser = await chromium.launch({
  executablePath: "/usr/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
});
for (const engine of (process.env.ENGINES || "a,b").split(",")) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => console.log("ERROR", String(e)));
  page.on("console", (m) => {
    if (m.type() === "error") console.log(m.text());
  });
  await page.goto(`http://127.0.0.1:4173/?engine=${engine}&benchmark`);
  try {
    await page.waitForFunction(
      () => window.prototype?.metrics.ready > 0,
      {},
      { timeout: 60000 },
    );
  } catch {}
  console.log(engine, await page.evaluate(() => window.prototype?.metrics));
  await page.screenshot({ path: `results/smoke-${engine}.png` });
  await context.close();
}
await browser.close();
