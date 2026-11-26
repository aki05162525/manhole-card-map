import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { fixtureData } from "../../../scripts/build/fixtures";
import {
  otherPrefecturePage,
  prefecturePages,
} from "../../domain/prefecture-pages";
import type { Data } from "../../domain/types";
import { renderCatalogPages } from "./static-catalog";

// The list's own HTML, whose head and root the build fills for each page.
const template = readFileSync("cards.html", "utf8");
const parse = (html: string | undefined) =>
  new DOMParser().parseFromString(html ?? "", "text/html");
const content = (page: Document, key: string) =>
  page
    .querySelector(`meta[name="${key}"],meta[property="${key}"]`)
    ?.getAttribute("content");
const hrefs = (page: Document, selector: string) =>
  [...page.querySelectorAll(`#root ${selector}`)].map((link) =>
    link.getAttribute("href"),
  );
function sample(): Data {
  const data = structuredClone(fixtureData);
  Object.assign(data.cards[0], { status: "ended", series: "第1弾" });
  // A municipality outside the prefectures, and one whose name needs escaping.
  Object.assign(data.cards[4], { pref: "団体", city: '<b>"公社" & 組合</b>' });
  return data;
}
const tokyo = (data: Data) =>
  data.cards.filter((card) => card.pref === "東京都");

it("writes a page for each prefecture and the others, read without the script", () => {
  const data = sample();
  const pages = renderCatalogPages(data, template);
  expect(new Set(pages.keys())).toEqual(
    new Set([
      "cards.html",
      ...[...prefecturePages, otherPrefecturePage].map(
        (pref) => `pref/${pref.slug}/index.html`,
      ),
    ]),
  );
  const page = parse(pages.get("pref/tokyo/index.html"));
  const cards = tokyo(data);
  expect(cards.length).toBeGreaterThan(1);
  // Each of the prefecture's cards, linked by the municipality's name.
  const rows = [...page.querySelectorAll("#root article")];
  expect(
    rows.map((row) => row.querySelector("a")?.getAttribute("href")),
  ).toEqual(
    // In the order the script lists them.
    cards
      .map((card) => card.id)
      .sort((a, b) => a.localeCompare(b))
      .map((id) => `/card/${id}/`),
  );
  const row = rows.find((row) => row.textContent.includes(cards[0].id))!;
  expect(row.querySelector("a")?.textContent).toBe("合成テスト：東京A");
  expect(row.textContent).toContain("第1弾");
  expect(row.textContent).toContain("終了");
  expect(row.textContent).toContain("ほか1施設");
  // No other prefecture's card, and the way to the other prefectures.
  expect(page.querySelector("#root")?.textContent).not.toContain("大阪");
  expect(hrefs(page, "main a:not(article a)")).toEqual(["/cards"]);
  expect(page.querySelector("#root h1")?.textContent).toBe(
    "東京都のマンホールカード一覧と配布場所",
  );
  expect(page.querySelector("#root .techo-count")?.textContent).toBe(
    `${cards.length}枚`,
  );
  // The script still starts from the root the build counted on.
  expect(page.querySelector("#root script")).toBeNull();
  expect(
    page.querySelector("#root")?.hasAttribute("data-catalog-summary"),
  ).toBe(true);
});

it("gives each prefecture's page a head of its own", () => {
  const data = sample();
  const pages = renderCatalogPages(data, template);
  const page = parse(pages.get("pref/tokyo/index.html"));
  const title = "東京都のマンホールカード一覧｜配布場所の地図 - マンホール手帳";
  const description = `東京都の${tokyo(data).length}枚のマンホールカードの配布場所・配布時間・配布状態を一覧と地図で確認できます。`;
  const url = "https://manhole-techo.com/pref/tokyo/";
  expect(page.title).toBe(title);
  expect(content(page, "og:title")).toBe(title);
  expect(content(page, "description")).toBe(description);
  expect(content(page, "og:description")).toBe(description);
  expect(
    page.querySelector('link[rel="canonical"]')?.getAttribute("href"),
  ).toBe(url);
  expect(content(page, "og:url")).toBe(url);
  // Nothing of the whole list's head is left on it.
  expect(pages.get("pref/tokyo/index.html")).not.toMatch(
    /manhole-techo\.com\/cards"|都道府県別の配布場所/,
  );
  const other = parse(pages.get("pref/other/index.html"));
  expect(other.title).toBe(
    "その他の団体のマンホールカード一覧｜配布場所の地図 - マンホール手帳",
  );
  expect(
    other.querySelector('link[rel="canonical"]')?.getAttribute("href"),
  ).toBe("https://manhole-techo.com/pref/other/");
  expect(other.querySelector("#root article a")?.textContent).toBe(
    '<b>"公社" & 組合</b>',
  );
  expect(other.querySelector("#root article b")).toBeNull();
});

it("says that a prefecture has no card yet, without counting none", () => {
  const pages = renderCatalogPages(sample(), template);
  const page = parse(pages.get("pref/okinawa/index.html"));
  expect(page.querySelectorAll("#root article")).toHaveLength(0);
  expect(page.querySelector("#root main")?.textContent).not.toMatch(/0\s*枚/);
  expect(content(page, "description")).toBe(
    "沖縄県のマンホールカードの配布場所・配布時間・配布状態を一覧と地図で確認できます。",
  );
  expect(hrefs(page, "main a")).toEqual(["/cards"]);
});

it("lists the prefectures with their counts in the whole list's HTML, not the cards", () => {
  const data = sample();
  const pages = renderCatalogPages(data, template);
  const page = parse(pages.get("cards.html"));
  expect(hrefs(page, "main a")).toEqual(
    [...prefecturePages, otherPrefecturePage].map(
      (pref) => `/pref/${pref.slug}/`,
    ),
  );
  const link = (slug: string) =>
    page.querySelector(`#root a[href="/pref/${slug}/"]`)?.textContent;
  expect(link("tokyo")).toBe(`東京都${tokyo(data).length}枚`);
  expect(link("osaka")).toBe("大阪府1枚");
  expect(link("okinawa")).toBe("沖縄県0枚");
  expect(link("other")).toBe("その他（県の登録なし）1枚");
  expect(page.querySelector("#root h1")?.textContent).toBe(
    "マンホールカード一覧",
  );
  // The head stays the whole list's.
  expect(parse(template).head.innerHTML).toBe(page.head.innerHTML);
});

// A fixture build's list warns that its cards are made up; so does what it
// writes for a reader without the script.
it("warns of synthetic data on every page of a fixture build, and on none of a real one", () => {
  const warning =
    "検証用の架空データです。実際の訪問先として使わないでください。";
  const notices = (pages: Map<string, string>) =>
    ["cards.html", "pref/tokyo/index.html", "pref/okinawa/index.html"].map(
      (path) =>
        parse(pages.get(path)).querySelector('#root main [role="status"]')
          ?.textContent,
    );
  expect(
    notices(renderCatalogPages(sample(), template, { fixture: true })),
  ).toEqual([warning, warning, warning]);
  expect(notices(renderCatalogPages(sample(), template))).toEqual([
    undefined,
    undefined,
    undefined,
  ]);
});

it("stops the build when the list's HTML no longer has what it rewrites", () => {
  expect(() =>
    renderCatalogPages(
      sample(),
      template.replace('<div id="root"', '<div id="app"'),
    ),
  ).toThrow(/root/);
  expect(() =>
    renderCatalogPages(
      sample(),
      template.replace(
        'rel="canonical" href="https://manhole-techo.com/cards"',
        'rel="canonical" href="https://manhole-techo.com/list"',
      ),
    ),
  ).toThrow(/cards\.html/);
});
