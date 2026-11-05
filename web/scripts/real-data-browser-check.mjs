// Existing real-data server only: no build, server lifecycle, or fixture mutation.
import assert from "node:assert/strict";
import { chromium } from "playwright";

const origin = process.env.REAL_DATA_ORIGIN || "http://127.0.0.1:4180";
const cases = [
  ["14-100-A001", "横浜駅観光案内所", "active", 1],
  ["14-100-D001", "桜木町駅観光案内所", "active", 1],
  ["01-100-C001", "01-100-C001", "active", 2],
  ["01-218-A001", "01-218-A001", "suspended", 1],
  ["01-231-B001", "01-231-B001", "ended", 0],
];
const response = await fetch(`${origin}/data/full.json`);
assert.ok(response.ok);
const data = await response.json();
assert.ok(
  !data.fixture && data.cards.length > 1000,
  "requires national real data",
);
const browser = await chromium.launch({
  ...(process.env.CHROME ? { executablePath: process.env.CHROME } : {}),
  args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
});
const failures = [];
console.log(
  JSON.stringify({
    origin,
    chromium: browser.version(),
    updated: data.updated,
    cards: data.cards.length,
  }),
);
try {
  for (const mode of ["full", "split"]) {
    // Independent ephemeral profiles: no existing user's SW/cache/storage.
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.stack || String(error)));
    try {
      await page.goto(`${origin}/?data=${mode}`);
      await page.waitForFunction(() => window.prototype?.metrics.ready > 0);
      assert.equal(await page.locator("#fixture-warning").count(), 0);
      assert.equal(
        await page.locator("#cards option").count(),
        data.cards.length + 1,
      );
      for (const [id, search, status, facilities] of cases) {
        try {
          if (await page.locator("#detail").count()) {
            await page
              .getByRole("button", { name: "閉じる", exact: true })
              .click();
            await page.locator("#detail").waitFor({ state: "detached" });
          }
          await page.locator("#search").fill(search);
          await page
            .locator(`#cards option[value="${id}"]`)
            .waitFor({ state: "attached" });
          await page.locator("#cards").selectOption(id);
          await page
            .locator("#detail .card-meta")
            .filter({ hasText: id })
            .waitFor();
          assert.equal(
            await page.locator("#detail .facility").count(),
            facilities,
          );
          assert.equal(
            await page.locator(`#detail > p .status-badge.${status}`).count(),
            1,
          );
          const card = data.cards.find((item) => item.id === id);
          const places = data.pins.filter(
            (pin) =>
              pin.kind === "place" &&
              !pin.reference &&
              pin.cardIds.includes(id) &&
              data.places.some(
                (place) =>
                  place.id === pin.id &&
                  place.coordinate.status === "confirmed",
              ),
          );
          const placeButton = page.getByRole("button", {
            name: "配布場所を見る",
            exact: true,
          });
          assert.equal(await placeButton.isEnabled(), places.length > 0);
          // A real canvas click, never adapter.select/onSelect. For cards with no
          // confirmed facility, click their lid after revealing it below.
          async function clickPin() {
            await page.waitForFunction(
              () => window.prototype.adapter.tapPoint() !== null,
            );
            // Flush the preceding selection's paint before measuring a new map selection.
            await page.evaluate(() => window.prototype.painted());
            const taps = await page.evaluate(
              () => window.prototype.metrics.taps.length,
            );
            const point = await page.evaluate(() =>
              window.prototype.adapter.tapPoint(),
            );
            const box = await page.locator("#map").boundingBox();
            await page.mouse.click(box.x + point.x, box.y + point.y);
            await page.waitForFunction(
              (count) => window.prototype.metrics.taps.length > count,
              taps,
            );
            const group = page.getByLabel("この位置・範囲のカード一覧");
            await page.waitForFunction(
              (id) =>
                document
                  .querySelector("#detail .card-meta")
                  ?.textContent.includes(id) ||
                !!document.querySelector(
                  'select[aria-label="この位置・範囲のカード一覧"]',
                ),
              id,
            );
            if (await group.count()) {
              await group.selectOption(id);
              await group.press("Enter");
            }
            await page
              .locator("#detail .card-meta")
              .filter({ hasText: id })
              .waitFor();
          }
          if (places.length) {
            await placeButton.click();
            await clickPin();
          }
          await page
            .getByRole("button", { name: "このカードの蓋を見る", exact: true })
            .click();
          await page.waitForFunction(
            ({ lng }) =>
              Math.abs(window.prototype.adapter.view().lng - lng) < 0.005,
            card.lid,
          );
          if (!places.length) await clickPin();
          const links = await page
            .locator('#detail a[href*="google.com/maps"]')
            .evaluateAll((nodes) =>
              nodes.map((node) => ({
                href: node.href,
                text: node.textContent,
                rel: node.rel,
                target: node.target,
              })),
            );
          assert.equal(links.length, facilities + 1);
          for (const link of links) {
            const url = new URL(link.href);
            assert.equal(
              url.origin + url.pathname,
              "https://www.google.com/maps/search/",
            );
            assert.equal(url.searchParams.get("api"), "1");
            assert.ok(url.searchParams.get("query"));
            assert.ok(link.rel.includes("noopener"));
            assert.equal(link.target, "_blank");
          }
          const lid = links.find((link) => link.text.startsWith("蓋"));
          assert.equal(
            new URL(lid.href).searchParams.get("query"),
            `${card.lid.lat},${card.lid.lng}`,
          );
          for (const relation of data.relations.filter(
            (item) => item.cardId === id,
          )) {
            const place = data.places.find(
              (item) => item.id === relation.placeId,
            );
            const query =
              place.coordinate.status === "confirmed"
                ? `${place.coordinate.lat},${place.coordinate.lng}`
                : `${place.name.trim()} ${place.address.trim()}`.trim();
            assert.ok(
              links.some(
                (link) =>
                  new URL(link.href).searchParams.get("query") === query,
              ),
            );
          }
          assert.ok(await page.locator("#root > main").count());
          assert.deepEqual(errors, []);
          console.log(
            JSON.stringify({
              mode,
              id,
              result: "PASS",
              facilities,
              pin: places.length ? "facility" : "lid",
              links,
            }),
          );
        } catch (error) {
          const diagnostics = await page.evaluate(() => ({
            rootEmpty: !document.querySelector("#root")?.children.length,
            metrics: window.prototype?.metrics,
          }));
          failures.push({
            mode,
            id,
            error: String(error),
            pageErrors: [...errors],
            diagnostics,
          });
          console.error(JSON.stringify(failures.at(-1)));
          // Continue independent cases after a crashed React root.
          await page.reload();
          await page.waitForFunction(() => window.prototype?.metrics.ready > 0);
          errors.length = 0;
        }
      }
    } finally {
      await context.close();
    }
  }
  assert.deepEqual(
    failures,
    [],
    "real-data regressions (see per-card diagnostics)",
  );
} finally {
  await browser.close();
}
