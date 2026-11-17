import { afterEach, describe, expect, it, vi } from "vitest";
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
    expect(page.querySelectorAll("h3")).toHaveLength(2);
    expect(page.body.textContent).toContain("休日");
    expect(page.body.textContent).toContain("9:00–17:00（合成）");
    expect(page.body.textContent).not.toMatch(
      /35\.7|139\.78|null|undefined|在庫は保証|基準日|非公式|出典をご確認|住所/,
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
  it("names a card by its prefecture once, whether or not the municipality repeats it", () => {
    const data = sample();
    Object.assign(data.cards[0]!, {
      id: "13-101-F001",
      city: "東京都 千代田区 (F001)",
    });
    data.cards[1]!.city = "東京都 （流域下水道・A001）";
    data.cards[3]!.city = "東京都都市づくり公社";
    const pages = renderStaticPages(data);
    const page = doc(pages.get("card/13-101-F001/index.html")!);
    const name = "東京都千代田区のマンホールカード";
    expect(page.querySelector("h1")?.textContent).toBe(name);
    expect(page.title).toBe(
      `${name}（テスト・13-101-F001）配布場所と配布時間 | マンホール手帳`,
    );
    for (const selector of [
      'meta[name="description"]',
      'meta[property="og:title"]',
      'meta[property="og:description"]',
    ])
      expect(page.querySelector(selector)?.getAttribute("content")).toMatch(
        /^東京都千代田区のマンホールカード（/,
      );
    const heading = (id: string) =>
      doc(pages.get(`card/${id}/index.html`)!).querySelector("h1")?.textContent;
    expect(heading(data.cards[1]!.id)).toBe(
      "東京都（流域下水道・A001）のマンホールカード",
    );
    expect(heading(data.cards[3]!.id)).toBe(
      "東京都都市づくり公社のマンホールカード",
    );
    // A municipality that does not name its prefecture still gets it.
    expect(heading(data.cards[4]!.id)).toBe(
      "東京都合成テスト：位置未確定のマンホールカード",
    );
  });
  it("lists a counter's planned change under it, as of the data's date", () => {
    const data = sample();
    data.evaluatedAt = "2026-11-17";
    data.relations[0]!.upcoming = [
      {
        validFrom: "2027-01-20",
        status: "active",
        hours: ["9:00～16:30"],
        condition: "",
      },
    ];
    const page = doc(
      renderStaticPages(data).get("card/TEST-TOKYO-1/index.html")!,
    );
    const items = [...page.querySelectorAll(".upcoming-changes li")];
    expect(items.map((item) => item.textContent)).toEqual([
      "2027-01-20から配布中\n9:00～16:30",
    ]);
    expect(page.body.textContent).toContain(
      "今後の変更（2026-11-17時点の予定）",
    );
    expect(page.querySelectorAll("h3")).toHaveLength(2);
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

describe("the card's image on its page", () => {
  afterEach(() => vi.unstubAllEnvs());
  const image = {
    path: "/card-images/TEST-TOKYO-1-abc.webp",
    credit: "合成テスト市下水道局",
    width: 640,
    height: 893,
  };
  const built = { image: "/assets/cardImage-abc.js" };
  it.each(["false", "true"])(
    "shows a permitted image whole, with its credit, in the built page (accounts=%s)",
    (accounts) => {
      vi.stubEnv("VITE_ACCOUNTS_ENABLED", accounts);
      const data = sample();
      data.cards[0]!.image = image;
      const pages = renderStaticPages(data, undefined, built);
      const page = doc(pages.get("card/TEST-TOKYO-1/index.html")!);
      const figures = page.querySelectorAll("main figure");
      expect(figures).toHaveLength(1);
      const img = figures[0]!.querySelector("img")!;
      expect(
        ["src", "width", "height", "alt", "loading"].map((name) =>
          img.getAttribute(name),
        ),
      ).toEqual([
        image.path,
        "640",
        "893",
        "合成テスト：東京Aのマンホールカード（TEST-TOKYO-1）",
        // The image leads the page: it is not put off.
        null,
      ]);
      expect(figures[0]!.querySelector("figcaption")?.textContent).toBe(
        "画像：合成テスト市下水道局",
      );
      // Read without any script; the script only clears a failed image.
      expect(
        [...page.querySelectorAll("script[src]")].map((element) =>
          element.getAttribute("src"),
        ),
      ).toEqual([built.image]);
      // Never the page's share image or icon; the head only fetches it early.
      expect(
        [...page.head.querySelectorAll("meta, link:not([rel=preload])")]
          .map((element) => element.outerHTML)
          .join(""),
      ).not.toContain("card-images");
      // A card without one gets no frame, stand-in or script.
      const plain = doc(pages.get("card/TEST-TOKYO-2/index.html")!);
      expect(plain.querySelector("main figure, main img")).toBeNull();
      expect(plain.querySelector("script[src]")).toBeNull();
      expect(
        doc(pages.get("pref/tokyo/index.html")!).querySelector("main img"),
      ).toBeNull();
    },
  );
  it("leads with the place and the kind of card, the state in words, then the counters under one heading", () => {
    const data = sample();
    data.cards[0]!.image = image;
    const page = doc(
      renderStaticPages(data, undefined, built).get(
        "card/TEST-TOKYO-1/index.html",
      )!,
    );
    expect(page.querySelectorAll("h1")).toHaveLength(1);
    expect(page.querySelector("h1")?.textContent).toBe(
      "東京都合成テスト：東京Aのマンホールカード",
    );
    const facts = [...page.querySelectorAll(".card-facts > *")].map(
      (element) => element.textContent,
    );
    expect(facts).toEqual([
      "配布状態",
      "終了",
      "カード番号",
      "TEST-TOKYO-1",
      "弾",
      "テスト",
      "発行日",
      "2000/01/01",
    ]);
    expect(
      [...page.querySelectorAll("main :is(h2, h3)")].map(
        (heading) => `${heading.tagName} ${heading.textContent}`,
      ),
    ).toEqual([
      "H2 配布場所",
      "H3 合成テスト共同配布所",
      "H3 合成テスト休日配布所",
      "H2 東京都のほかのカード",
    ]);
    expect(
      page.querySelector('main a[href="/?card=TEST-TOKYO-1"]')?.textContent,
    ).toBe("地図で配布場所を見る");
  });
});
describe("the record of a card page", () => {
  afterEach(() => vi.unstubAllEnvs());
  const script = "/assets/cardRecord-abc.js";
  it("adds a sign-in link back to the card, the card's public numbers and the script to the page as built", () => {
    vi.stubEnv("VITE_ACCOUNTS_ENABLED", "true");
    const data = sample();
    data.cards[0]!.id = "13-100 F001";
    data.cardAliases = { "OLD-1": "13-100 F001", "OLD-2": "TEST-TOKYO-2" };
    const pages = renderStaticPages(data, undefined, { record: script });
    const html = pages.get("card/13-100%20F001/index.html")!;
    const page = doc(html);
    const record = page.querySelector("#card-record")!;
    expect(record.getAttribute("data-card-id")).toBe("13-100 F001");
    expect(JSON.parse(record.getAttribute("data-card-aliases")!)).toEqual({
      "OLD-1": "13-100 F001",
    });
    const link = record.querySelector("a")!;
    expect(link.textContent).toBe("ログインして入手を記録");
    expect(link.getAttribute("href")).toBe(
      "/account?returnTo=%2Fcard%2F13-100%2520F001%2F",
    );
    expect(
      [...page.querySelectorAll("script[src]")].map((element) => [
        element.getAttribute("type"),
        element.getAttribute("src"),
      ]),
    ).toEqual([["module", script]]);
    // The public text is the page's own, with or without the script.
    expect(page.querySelector("h1")?.textContent).toContain(
      "のマンホールカード",
    );
    expect(page.querySelector(".card-facts")?.textContent).toContain(
      "13-100 F001",
    );
    expect(page.querySelectorAll("h2").length).toBeGreaterThan(0);
    expect(html).not.toMatch(/\/api\/|memo|receivedOn|session/);
    // A card with no earlier number carries none; a prefecture has no record.
    expect(
      doc(pages.get("card/TEST-OSAKA/index.html")!)
        .querySelector("#card-record")!
        .hasAttribute("data-card-aliases"),
    ).toBe(false);
    const pref = doc(pages.get("pref/tokyo/index.html")!);
    expect(pref.querySelector("#card-record, script[src]")).toBeNull();
  });
  it.each([
    ["a build without accounts", "false", script],
    ["a build whose record script is missing", "true", undefined],
  ])("adds nothing in %s", (_name, enabled, built) => {
    vi.stubEnv("VITE_ACCOUNTS_ENABLED", enabled);
    const page = doc(
      renderStaticPages(sample(), undefined, { record: built }).get(
        "card/TEST-TOKYO-1/index.html",
      )!,
    );
    expect(page.querySelector("#card-record, script[src]")).toBeNull();
    expect(page.querySelector("main")!.textContent).not.toContain("ログイン");
    expect(page.querySelector("h1")?.textContent).toBe(
      "東京都合成テスト：東京Aのマンホールカード",
    );
  });
});
it("links each municipality in the contents to a unique heading including escaped names", () => {
  const data = sample();
  data.cards[0]!.city = "東京市 （A001）";
  data.cards[1]!.city = "東京市 (B001)";
  data.cards[3]!.city = '市 <>&"';
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

it("links generated prefecture and card pages to extensionless site documents", () => {
  for (const [path, html] of renderStaticPages(sample())) {
    if (!path.endsWith(".html")) continue;
    const links = [...doc(html).querySelectorAll("a[href]")].map((a) =>
      a.getAttribute("href")!,
    );
    expect(links).toContain("/cards");
    expect(links).toContain("/about");
    expect(
      links.filter(
        (href) => href.startsWith("/") && /\.html(?:[?#]|$)/.test(href),
      ),
    ).toEqual([]);
  }
});
