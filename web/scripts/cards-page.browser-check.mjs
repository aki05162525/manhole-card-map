import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fixtureData } from "./fixtures.ts";

export async function checkCardsPage(browser, origin) {
  const page = await browser.newPage({ viewport: { width: 412, height: 823 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  const requested = [];
  page.on("request", (request) => requested.push(request.url()));
  const base = fixtureData.cards[0];
  const data = {
    schema: 1,
    updated: "2026-11-07",
    evaluatedAt: "2026-11-06",
    cards: [
      ...Array.from({ length: 101 }, (_, i) => ({
        ...base,
        id: `13-${String(i).padStart(3, "0")}-A001`,
        pref: "東京都",
        city: i === 0 ? "観光のまち" : `東京${i}市`,
      })),
      { ...base, id: "01-001-A001", pref: "北海道", city: "観光のまち北海道" },
      { ...base, id: "00-101-A001", pref: "", city: "県登録なし" },
    ],
    places: [
      {
        id: "facility",
        name: "長い名称の観光案内所・地域交流情報発信拠点",
        address: "埼玉県戸田市",
        phone: "",
        coordinate: { status: "unconfirmed" },
      },
    ],
    relations: [
      {
        cardId: "00-101-A001",
        placeId: "facility",
        condition: "平日限定",
        periodRaw: "夏季",
        alternativeRaw: "",
      },
    ],
    pins: [],
  };
  data.places.push({
    id: "mapped",
    name: "地図に表示する施設",
    address: "東京都",
    phone: "",
    coordinate: { status: "confirmed", lat: 35, lng: 139 },
  });
  data.pins.push({
    id: "mapped",
    pref: "東京都",
    kind: "place",
    cardIds: ["13-000-A001"],
    status: "active",
    lat: 35,
    lng: 139,
  });
  let fail = false;
  let delay = false;
  await page.route("**/data/full.json", async (route) => {
    if (delay) await new Promise((resolve) => setTimeout(resolve, 250));
    if (fail) await route.fulfill({ status: 503, body: "unavailable" });
    else await route.fulfill({ json: data });
  });
  // The build has no pages for the routed cards above; a card page it does
  // have answers for them, so the list's links and the way back are what is
  // checked here.
  await page.route("**/card/*/", async (route) =>
    route.fulfill({
      response: await route.fetch({
        url: `${origin}/card/${fixtureData.cards[0].id}/`,
      }),
    }),
  );
  delay = true;
  await page.goto(`${origin}/cards`);
  // The summary cards.html carries draws the regions before the data (#259).
  await page.getByRole("region", { name: "地域から選ぶ" }).waitFor();
  assert.equal(
    await page.getByRole("status").filter({ hasText: "読み込み中" }).count(),
    0,
  );
  delay = false;
  assert.equal(await page.locator("[data-pref]").count(), 48);
  assert.equal(await page.locator(".catalog-region").count(), 9);
  assert.equal(await page.locator(".catalog-row").count(), 0);
  await page.getByText("検証用の架空データ", { exact: false }).waitFor();
  await page.locator('[data-pref="13"]').click();
  await page.locator(".catalog-row").first().waitFor();
  assert.equal(await page.locator(".catalog-row").count(), 50);
  assert.equal(await page.locator("optgroup").count(), 9);
  await page.getByRole("button", { name: "次へ", exact: true }).click();
  await page.waitForURL("**pref=13&page=2");
  await page.waitForFunction(
    () => document.querySelectorAll(".catalog-row").length === 50,
  );
  assert.equal(await page.locator(".catalog-row").count(), 50);
  await page.getByRole("button", { name: "次へ", exact: true }).click();
  assert.equal(await page.locator(".catalog-row").count(), 1);
  await page.getByRole("searchbox").fill("観光");
  assert.equal(new URL(page.url()).searchParams.get("q"), null);
  await page.getByRole("button", { name: "検索", exact: true }).click();
  assert.equal(await page.locator(".catalog-row").count(), 1);
  assert.equal(new URL(page.url()).searchParams.get("page"), null);
  await page.evaluate(() =>
    history.replaceState({ ...history.state, mapFocus: { pref: "13" } }, ""),
  );
  // A row is a plain link to the card's own page, another document.
  const row = page.locator(".catalog-row").getByRole("link").first();
  assert.equal(await row.getAttribute("href"), "/card/13-000-A001/");
  await row.click();
  await page.waitForURL("**/card/13-000-A001/");
  // Back gives the list as it was left: the prefecture and the query.
  await page.goBack();
  await page.waitForURL("**pref=13&q=*");
  assert.equal(new URL(page.url()).searchParams.get("page"), null);
  await page.locator(".catalog-row").waitFor();
  assert.equal(await page.locator(".catalog-row").count(), 1);
  assert.equal(await page.getByRole("searchbox").inputValue(), "観光");
  assert.equal(await page.locator(".card-detail-content").count(), 0);
  assert.deepEqual(await page.evaluate(() => history.state.mapFocus), {
    pref: "13",
  });
  await page.goBack();
  await page.waitForURL("**pref=13&page=3");
  await page.waitForFunction(
    () => document.getElementById("catalog-search").value === "",
  );
  assert.equal(await page.getByRole("searchbox").inputValue(), "");
  assert.equal(await page.locator(".catalog-row").count(), 1);
  await page.goBack();
  await page.waitForURL("**pref=13&page=2");
  await page.waitForFunction(
    () => document.querySelectorAll(".catalog-row").length === 50,
  );
  assert.equal(await page.locator(".catalog-row").count(), 50);
  await page.goBack();
  await page.goBack();
  await page.waitForURL("**/cards");
  await page.locator("[data-pref]").first().waitFor();
  assert.equal(await page.locator("[data-pref]").count(), 48);
  // A link from when the list showed the detail: the card's page takes that
  // entry's place, so back does not come round to it again.
  await page.goto(`${origin}/cards?pref=13&q=観光&card=00-101-A001`);
  await page.waitForURL("**/card/00-101-A001/");
  await page.goBack();
  await page.waitForURL("**/cards");
  assert.equal(new URL(page.url()).search, "");
  await page.goto(`${origin}/cards?pref=13&q=観光`);
  await page.locator(".catalog-row").waitFor();
  await page.locator("#catalog-pref").selectOption("other");
  await page.waitForURL("**pref=other&q=*");
  await page.waitForFunction(
    () => document.querySelectorAll(".catalog-row").length === 1,
  );
  await page.goto(`${origin}/cards?pref=other&q=戸田市`);
  await page.locator(".catalog-row").waitFor();
  assert.equal(await page.locator(".catalog-row").count(), 1);
  await page.goto(`${origin}/cards?pref=bad&page=999&card=missing`);
  await page
    .getByRole("button", { name: "指定を修正して一覧へ戻る" })
    .waitFor();
  assert.equal(await page.locator(".catalog-row").count(), 0);
  await page.getByRole("region", { name: "地域から選ぶ" }).waitFor();
  await page.getByRole("button", { name: "指定を修正して一覧へ戻る" }).click();
  assert.equal(new URL(page.url()).search, "");
  fail = true;
  await page.reload();
  await page.getByRole("button", { name: "再読み込み", exact: true }).waitFor();
  assert.equal(await page.locator(".catalog-row").count(), 0);
  assert.equal(await page.locator(".catalog-results").count(), 0);
  fail = false;
  await page.getByRole("button", { name: "再読み込み", exact: true }).click();
  await page.getByRole("region", { name: "地域から選ぶ" }).waitFor();
  console.log(
    "PASS: loading, failure/retry, fixture warning, 47 prefectures/other, scoped search, 50-row pagination, rows to card pages and back, old detail URLs, history/mapFocus and popstate",
  );

  // Saved real data is required for nullable and ended-card regressions.
  const real = JSON.parse(await readFile("public/data/full.json", "utf8"));
  await page.unroute("**/data/full.json");
  await page.route("**/data/full.json", (route) =>
    route.fulfill({ json: real }),
  );
  for (const id of [
    "00-101-A001",
    "00-102-A001",
    "00-102-B001",
    "01-231-B001",
    "01-406-A001",
    "01-202-A001",
    "01-100-C001",
  ]) {
    // The rows of these cards; their details are the static pages
    // (scripts/static-pages.test.ts).
    await page.goto(`${origin}/cards?${new URLSearchParams({ q: id })}`);
    await page.locator(".catalog-row").first().waitFor();
    assert.equal(
      await page
        .locator(`.catalog-row a[href="/card/${encodeURIComponent(id)}/"]`)
        .count(),
      1,
    );
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
  }
  assert.deepEqual(errors, []);
  assert.deepEqual(
    // The map's chunks and stylesheet as built, its worker and its style.
    requested.filter((url) =>
      /\/assets\/(?:maplibre-gl|card-map|map-screen|style)-|worker|map-style/.test(
        url,
      ),
    ),
    [],
  );
  console.log(
    "PASS: real-data rows, no horizontal overflow, no page errors or map dependencies requested",
  );
  await page.close();
}
