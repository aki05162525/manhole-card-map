import { describe, expect, it } from "vitest";
// @vitest-environment jsdom
import { fixtureData } from "./fixtures";
import { renderStaticPages } from "./static-pages";
import type { Data } from "../src/domain/types";

function sample(): Data {
  const data = structuredClone(fixtureData);
  Object.assign(data.cards[0]!, {
    status: "ended",
    placeText: null,
    hours: null,
    links: null,
  });
  data.relations[0]!.evidence = {
    sourceUrl: "https://example.com/source",
    checkedAt: "2000-01-01",
  };
  return data;
}
const doc = (html: string) =>
  new DOMParser().parseFromString(html, "text/html");
describe("static destination pages", () => {
  it("groups edition suffixes under one municipality heading", () => {
    const data = sample();
    data.cards[0]!.city = "東京市 （A001）";
    data.cards[1]!.city = "東京市 (B001)";
    const page = doc(renderStaticPages(data).get("pref/tokyo/index.html")!);
    expect(
      [...page.querySelectorAll("h2")]
        .map((x) => x.textContent)
        .filter((x) => x?.startsWith("東京市")),
    ).toEqual(["東京市"]);
  });
  it("renders prefecture metadata, municipality headings and linked cards without JS", () => {
    const pages = renderStaticPages(sample());
    const page = doc(pages.get("pref/tokyo/index.html")!);
    expect(page.title).toBe(
      "東京都のマンホールカード配布場所一覧（4枚）| マンホール手帳",
    );
    expect(page.querySelector("h1")?.textContent).toBe(
      "東京都のマンホールカード配布場所",
    );
    expect(
      page.querySelector('link[rel="canonical"]')?.getAttribute("href"),
    ).toBe("https://manhole-techo.com/pref/tokyo/");
    expect(page.querySelector("h2")?.textContent).toBe("合成テスト：東京A");
    expect(page.querySelector(".static-actions a")?.getAttribute("href")).toBe(
      "/?card=TEST-TOKYO-1",
    );
    expect(page.querySelector('a[href="/card/TEST-TOKYO-1/"]')).not.toBeNull();
    expect(page.body.textContent).toContain("終了");
    expect(
      JSON.parse(
        page.querySelector('script[type="application/ld+json"]')!.textContent!,
      ).itemListElement,
    ).toHaveLength(2);
    expect(page.querySelector("script[src]")).toBeNull();
  });
  it("renders null fields, multiple counters, conditions, evidence and map links", () => {
    const page = doc(
      renderStaticPages(sample()).get("card/TEST-TOKYO-1/index.html")!,
    );
    expect(page.title).toBe(
      "東京都合成テスト：東京Aのマンホールカード（テスト・TEST-TOKYO-1）配布場所と配布時間 | マンホール手帳",
    );
    expect(page.querySelector("h1")?.textContent).toBe(
      "東京都合成テスト：東京Aのマンホールカード",
    );
    expect(page.querySelectorAll("h2")).toHaveLength(3);
    expect(page.body.textContent).toContain("休日");
    expect(page.body.textContent).toContain("9:00–17:00（合成）");
    expect(page.body.textContent).not.toMatch(
      /35\.7|139\.78|null|undefined|在庫は保証|基準日|非公式/,
    );
    expect(
      page.querySelector('a[href="https://example.com/source"]'),
    ).not.toBeNull();
    expect(page.querySelector('a[href="/?card=TEST-TOKYO-1"]')).not.toBeNull();
    expect(
      page.querySelector('meta[property="og:url"]')?.getAttribute("content"),
    ).toBe("https://manhole-techo.com/card/TEST-TOKYO-1/");
    expect(
      JSON.parse(
        page.querySelector('script[type="application/ld+json"]')!.textContent!,
      ).itemListElement,
    ).toHaveLength(3);
  });
  it("handles unknown destinations, unmapped organizations and safe escaping", () => {
    const data = sample();
    Object.assign(data.cards[4]!, {
      pref: "団体",
      city: '</script><script>alert("x")</script>',
      status: "unknown",
      placeText: null,
      hours: null,
      links: ["javascript:alert(1)"],
    });
    const pages = renderStaticPages(data);
    const page = doc(pages.get("card/TEST-UNKNOWN/index.html")!);
    expect(page.body.textContent).toContain("未確認");
    expect(page.body.textContent).toContain("配布場所の登録なし");
    expect(page.querySelectorAll("script")).toHaveLength(1);
    expect(page.querySelector('a[href^="javascript:"]')).toBeNull();
    expect(pages.has("pref/other/index.html")).toBe(true);
  });
  it("includes all 47 prefectures and each card exactly once in sitemap with stable dates", () => {
    const data = sample();
    data.evaluatedAt = "2000-02-01";
    const pages = renderStaticPages(data);
    const xml = new DOMParser().parseFromString(
      pages.get("sitemap.xml")!,
      "text/xml",
    );
    expect(xml.querySelectorAll("url")).toHaveLength(
      3 + 47 + data.cards.length,
    );
    expect(
      new Set([...xml.querySelectorAll("loc")].map((x) => x.textContent)).size,
    ).toBe(55);
    expect(
      [...xml.querySelectorAll("lastmod")].every(
        (x) => x.textContent === "2000-02-01",
      ),
    ).toBe(true);
    expect(pages.get("robots.txt")).toContain(
      "Sitemap: https://manhole-techo.com/sitemap.xml",
    );
    expect(pages.has("card/xxx/index.html")).toBe(false);
  });
});

it("links each municipality in the contents to a unique heading including escaped names", () => {
  const data = sample();
  data.cards[0]!.city = "東京市 （A001）";
  data.cards[1]!.city = "東京市 (B001)";
  data.cards[2]!.city = '市 <>&"';
  const page = doc(renderStaticPages(data).get("pref/tokyo/index.html")!);
  const links = [
    ...page.querySelectorAll('nav[aria-label="自治体から探す"] a'),
  ];
  expect(links).toHaveLength(3);
  expect(new Set(links.map((link) => link.getAttribute("href"))).size).toBe(3);
  for (const link of links) {
    const heading = page.getElementById(link.getAttribute("href")!.slice(1));
    expect(heading?.tagName).toBe("H2");
    expect(heading?.textContent).toBe(link.textContent);
  }
});
it("links all other cards in the same municipality beyond the prefecture suggestions", () => {
  const data = sample();
  const card = data.cards[0]!;
  data.cards.push(
    ...Array.from({ length: 7 }, (_, i) => ({
      ...card,
      id: `SAME-${i}`,
      city: `${card.city} (B00${i})`,
    })),
  );
  const page = doc(renderStaticPages(data).get(`card/${card.id}/index.html`)!);
  const section = [...page.querySelectorAll("section")].find(
    (s) => s.querySelector("h2")?.textContent === "同じ自治体のカード",
  );
  expect(section).toBeTruthy();
  expect(section!.querySelectorAll("a")).toHaveLength(7);
  expect(section!.querySelector(`a[href="/card/${card.id}/"]`)).toBeNull();
});
