// 性能測定とは別に、合成カードで2種類のピンと複数場所の操作を検査する。
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { readFile, writeFile } from "node:fs/promises";
const actual = JSON.parse(await readFile("public/data/full.json", "utf8"));
assert.equal(actual.cards.length, 1313);
const cardIDs = new Set(actual.cards.map((c) => c.id));
const placeIDs = new Set(actual.places.map((p) => p.id));
assert.equal(cardIDs.size, actual.cards.length);
assert.equal(placeIDs.size, actual.places.length);
for (const r of actual.relations) {
  assert.ok(cardIDs.has(r.cardId));
  assert.ok(placeIDs.has(r.placeId));
}
for (const pin of actual.pins) {
  assert.ok(pin.cardIds.every((id) => cardIDs.has(id)));
  assert.ok(Number.isFinite(pin.lat) && Number.isFinite(pin.lng));
  if (pin.kind === "lid")
    assert.equal(
      actual.cards.find((c) => c.id === pin.cardIds[0]).lid.status,
      "confirmed",
    );
}
for (const id of ["09-201-C001", "27-226-B001", "38-402-A001", "15-227-A001"]) {
  assert.ok(cardIDs.has(id));
  assert.ok(
    !actual.pins.some((p) => p.kind === "lid" && p.cardIds.includes(id)),
  );
}
const browser = await chromium.launch({
  executablePath: process.env.CHROME || "/usr/bin/google-chrome",
  args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
});
const findings = [];
try {
  for (const engine of ["a", "b"]) {
    const context = await browser.newContext({
      viewport: { width: 412, height: 823 },
      deviceScaleFactor: 1.75,
    });
    await context.addInitScript(() => {
      navigator.geolocation.getCurrentPosition = (_ok, fail) =>
        fail({
          code: 1,
          message: "試験用の拒否",
          PERMISSION_DENIED: 1,
          POSITION_UNAVAILABLE: 2,
          TIMEOUT: 3,
        });
    });
    const coord = {
      status: "confirmed",
      lat: 35,
      lng: 139,
      source: "合成試験",
      review: "実在施設ではない",
    };
    const card = {
      city: "合成試験の自治体",
      pref: "試験",
      series: "試験",
      issued: "2026/10/21",
      status: "ended",
      lid: coord,
      placeText: ["合成試験の場所。実在施設ではない"],
      hours: ["試験"],
      links: [],
      acquired: "2026-10-21",
    };
    const data = {
      schema: 1,
      updated: "2026-10-21",
      cards: [
        { ...card, id: "TEST-A" },
        { ...card, id: "TEST-B" },
      ],
      places: [
        {
          id: "test-place",
          name: "合成試験の配布場所",
          address: "実在しない試験データ",
          phone: "",
          coordinate: { ...coord, lat: 36, lng: 140 },
        },
      ],
      relations: [
        { cardId: "TEST-A", placeId: "test-place", condition: "試験条件" },
        { cardId: "TEST-B", placeId: "test-place", condition: "試験条件" },
      ],
      pins: [
        {
          id: "lid:TEST-A",
          cardIds: ["TEST-A"],
          kind: "lid",
          status: "ended",
          lat: 35,
          lng: 139,
          reference: false,
        },
        {
          id: "test-place",
          cardIds: ["TEST-A", "TEST-B"],
          kind: "place",
          status: "unknown",
          lat: 36,
          lng: 140,
          reference: false,
        },
      ],
    };
    await context.route("**/data/full.json", (r) => r.fulfill({ json: data }));
    // Aの背景画像は操作検査では使わない。実際のタイル通信は性能測定だけにする。
    await context.route("https://cyberjapandata.gsi.go.jp/**", (r) =>
      r.fulfill({
        contentType: "image/svg+xml",
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#e3ece8"/></svg>',
      }),
    );
    const page = await context.newPage();
    await page.goto(`http://127.0.0.1:4173/?engine=${engine}&benchmark`);
    await page.waitForFunction(
      () => window.prototype?.metrics.ready > 0,
      null,
      { timeout: 60000 },
    );
    await page.locator("#cards").selectOption("TEST-A");
    await page.waitForFunction(() => window.prototype.metrics.taps.length > 0);
    assert.match(await page.locator("#detail").innerText(), /在庫は未確認/);
    assert.match(
      await page.locator("#detail").innerText(),
      /合成試験の配布場所/,
    );
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `results/fixture-${engine}.png` });
    await page.locator("#detail button").click();
    await page.screenshot({ path: `results/closed-${engine}.png` });
    const previous = await page.evaluate(() => window.prototype.adapter.view());
    await page.locator("#locate").click();
    await page.waitForFunction(() =>
      document
        .querySelector("#notice")
        .textContent.includes("取得できなかった"),
    );
    const after = await page.evaluate(() => window.prototype.adapter.view());
    assert.deepEqual(after, previous);
    // benchmarkなしで前回の範囲を復元する。
    await page.goto(`http://127.0.0.1:4173/?engine=${engine}`);
    await page.waitForFunction(
      () => window.prototype?.metrics.ready > 0,
      null,
      { timeout: 60000 },
    );
    const restored = await page.evaluate(() => window.prototype.adapter.view());
    assert.ok(
      Math.abs(restored.lat - previous.lat) < 0.0001 &&
        Math.abs(restored.lng - previous.lng) < 0.0001,
    );
    findings.push({
      engine,
      fixture: true,
      detail: true,
      geolocationDenial: true,
      restore: true,
    });
    await context.close();
  }
  const session = await browser.newBrowserCDPSession();
  const system = await session.send("SystemInfo.getInfo");
  await writeFile("results/environment.json", JSON.stringify(system, null, 2));
  await writeFile("results/functional.json", JSON.stringify(findings, null, 2));
  console.log(findings);
} finally {
  await browser.close();
}
