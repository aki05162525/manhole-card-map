// Focused logo checks against an already running fixture build.
import assert from "node:assert/strict";
import { chromium } from "playwright";
const origin = process.env.LOGO_CHECK_ORIGIN || "http://127.0.0.1:4191";
const browser = await chromium.launch({ headless: true });
try {
  for (const reducedMotion of ["reduce", "no-preference"]) {
    const page = await browser.newPage({
      viewport: { width: 412, height: 915 },
      reducedMotion,
    });
    await page.goto(`${origin}/about.html`);
    await page.locator(".about-lid").waitFor();
    const result = await page.evaluate(async () => {
      const svg = document.querySelector(".about-lid");
      const animations = svg.getAnimations({ subtree: true });
      const timings = animations.map((a) => [
        a.effect.getTiming().duration,
        a.effect.getTiming().delay,
      ]);
      await Promise.all(animations.map((a) => a.finished));
      return {
        timings,
        bytes: new TextEncoder().encode(svg.outerHTML).length,
        lines: [...svg.querySelectorAll("[pathLength]")].map((e) => [
          getComputedStyle(e).strokeDasharray,
          getComputedStyle(e).strokeDashoffset,
        ]),
        pieces: [...svg.querySelectorAll("[data-step]")].map((e) => [
          getComputedStyle(e).opacity,
          getComputedStyle(e).scale,
          getComputedStyle(e).translate,
        ]),
      };
    });
    assert.ok(result.bytes <= 2048);
    assert.ok(
      result.lines.every(
        ([dash, offset]) => dash === "none" && offset === "0px",
      ),
    );
    assert.ok(
      result.pieces.every(
        ([opacity, scale, translate]) =>
          opacity === "1" && scale === "none" && translate === "none",
      ),
    );
    assert.deepEqual(
      result.timings,
      reducedMotion === "reduce"
        ? []
        : [
            [400, 0],
            [120, 400],
            [140, 520],
            [140, 600],
            [140, 680],
            [240, 820],
            [240, 820],
            [220, 1060],
            [160, 1280],
            [120, 1440],
            [120, 1560],
            [120, 1620],
            [160, 1780],
          ],
    );
    console.log("About", reducedMotion, JSON.stringify(result));
    await page.close();
  }
  for (const colorScheme of ["light", "dark"]) {
    const page = await browser.newPage({
      viewport: { width: 412, height: 915 },
      colorScheme,
    });
    await page.route("**/assets/card-map-*.js", (route) => route.abort());
    await page.goto(origin);
    const failure = page.locator(".map-failure .logo");
    await failure.waitFor();
    assert.equal(
      await failure.locator('rect[stroke-dasharray="2 1.4"]').count(),
      1,
    );
    assert.equal(await failure.locator("[fill-opacity]").count(), 0);
    await page
      .getByRole("button", { name: "カードを検索", exact: true })
      .click();
    assert.ok(await page.getByRole("searchbox").isVisible());
    await page.goto(`${origin}/404.html`);
    assert.equal(
      await page.locator('main .logo rect[stroke-dasharray="2 1.4"]').count(),
      1,
    );
    console.log("Map failure and 404 incomplete", colorScheme, "passed");
    await page.close();
  }
} finally {
  await browser.close();
}
