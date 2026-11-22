import { afterEach, describe, expect, it, vi } from "vitest";
// @vitest-environment jsdom
import { fixtureData } from "../../../scripts/build/fixtures";
import { renderStaticPages } from "./static-pages";
import type { Data } from "../../domain/types";

function sample(): Data {
  const data = structuredClone(fixtureData);
  Object.assign(data.cards[0], {
    status: "ended",
    placeText: null,
    hours: null,
    links: null,
  });
  data.relations[0].evidence = {
    sourceUrl: "https://example.com/source",
    checkedAt: "2000-01-01",
  };
  return data;
}
const doc = (html: string) =>
  new DOMParser().parseFromString(html, "text/html");
describe("static destination pages", () => {
  it("presents the confirmed lid destination as a map action", () => {
    const data = sample();
    data.cards[0].lid = { status: "confirmed", lat: 40.5, lng: 141.5 };
    const page = doc(
      renderStaticPages(data).get("card/TEST-TOKYO-1/index.html")!,
    );
    const link = page.querySelector("a.card-lid-link");
    expect(link?.textContent).toBe("地図で蓋の場所を見る");
    expect(link?.getAttribute("href")).toBe("/?card=TEST-TOKYO-1&step=lid");
  });
  it("puts a skip link to the focusable card title before all navigation", () => {
    const page = doc(
      renderStaticPages(sample()).get("card/TEST-TOKYO-1/index.html")!,
    );
    const first = page.body.querySelector("a[href], button");
    expect(first?.textContent).toBe("本文へ移動");
    const heading = page.querySelector("main h1")!;
    expect(first?.getAttribute("href")).toBe("#" + heading.id);
    expect(heading.getAttribute("tabindex")).toBe("-1");
  });
  it("shows the card number once in the labeled facts and the municipality in the breadcrumb", () => {
    const page = doc(
      renderStaticPages(sample()).get("card/TEST-TOKYO-1/index.html")!,
    );
    expect(page.body.textContent.match(/TEST-TOKYO-1/g)).toHaveLength(1);
    expect(
      page.querySelector('.static-breadcrumbs [aria-current="page"]')
        ?.textContent,
    ).toBe("合成テスト：東京A");
  });
  it("links the card breadcrumb and structured data to the filtered catalog", () => {
    const pages = renderStaticPages(sample());
    expect(
      [...pages.keys()].filter((path) => path.startsWith("pref/")),
    ).toEqual([]);
    const page = doc(pages.get("card/TEST-TOKYO-1/index.html")!);
    expect(
      page.querySelector('.static-breadcrumbs a[href="/cards?pref=13"]')
        ?.textContent,
    ).toBe("東京都");
    expect(
      JSON.parse(
        page.querySelector('script[type="application/ld+json"]')!.textContent,
      ).itemListElement[1].item,
    ).toBe("https://manhole-techo.com/cards?pref=13");
  });
  it("groups counters in the facts, displays status once and links to one distribution source", () => {
    const data = sample();
    data.cards[0].links = [
      "https://example.org/card",
      "https://example.com/source",
    ];
    const page = doc(
      renderStaticPages(data).get("card/TEST-TOKYO-1/index.html")!,
    );
    expect(
      page.querySelector(".card-facts > dt:last-of-type")?.textContent,
    ).toBe("配布場所");
    expect(
      page.querySelectorAll(".card-facts > dd.card-places > section"),
    ).toHaveLength(2);
    expect(page.querySelectorAll(".status-chip")).toHaveLength(1);
    expect(
      [...page.querySelectorAll("a")]
        .filter((link) => link.textContent.includes("配布情報の出典"))
        .map((link) => link.href),
    ).toEqual(["https://example.com/source"]);
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
    expect(page.querySelectorAll(".card-places h2")).toHaveLength(2);
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
        page.querySelector('script[type="application/ld+json"]')!.textContent,
      ).itemListElement,
    ).toHaveLength(3);
  });
  it("names a card by its prefecture once, whether or not the municipality repeats it", () => {
    const data = sample();
    Object.assign(data.cards[0], {
      id: "13-101-F001",
      city: "東京都 千代田区 (F001)",
    });
    data.cards[1].city = "東京都 （流域下水道・A001）";
    data.cards[3].city = "東京都都市づくり公社";
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
    expect(heading(data.cards[1].id)).toBe(
      "東京都（流域下水道・A001）のマンホールカード",
    );
    expect(heading(data.cards[3].id)).toBe(
      "東京都都市づくり公社のマンホールカード",
    );
    // A municipality that does not name its prefecture still gets it.
    expect(heading(data.cards[4].id)).toBe(
      "東京都合成テスト：位置未確定のマンホールカード",
    );
  });
  it("lists a counter's planned change under it, as of the data's date", () => {
    const data = sample();
    data.evaluatedAt = "2026-11-17";
    data.relations[0].upcoming = [
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
    expect(page.querySelectorAll(".card-places h2")).toHaveLength(2);
  });
  it("handles unknown destinations, unmapped organizations and safe escaping", () => {
    const data = sample();
    const id = "不明<&\"'</script>";
    Object.assign(data.cards[4], {
      id,
      pref: "団体",
      city: '</script><script>alert("x")</script>',
      status: "unknown",
      placeText: null,
      hours: null,
      links: ["javascript:alert(1)"],
    });
    const pages = renderStaticPages(data);
    const page = doc(pages.get(`card/${encodeURIComponent(id)}/index.html`)!);
    expect(page.body.textContent).toContain("未確認");
    expect(page.body.textContent).toContain("配布場所の登録なし");
    expect(page.querySelectorAll("script")).toHaveLength(1);
    const json = page.querySelector('script[type="application/ld+json"]')!;
    expect(JSON.parse(json.textContent).itemListElement.at(-1).name).toBe(
      data.cards[4].city,
    );
    expect(page.querySelector('a[href^="javascript:"]')).toBeNull();
    expect(page.querySelector('a[href="/cards?pref=other"]')).not.toBeNull();
  });
  it("includes the catalog and each card exactly once in sitemap with stable dates", () => {
    const data = sample();
    data.evaluatedAt = "2000-02-01";
    const pages = renderStaticPages(data);
    const xml = new DOMParser().parseFromString(
      pages.get("sitemap.xml")!,
      "text/xml",
    );
    expect(
      [...xml.querySelectorAll("loc")].map((loc) => loc.textContent).sort(),
    ).toEqual(
      [
        "/",
        "/cards",
        "/about",
        ...data.cards.map((card) => `/card/${card.id}/`),
      ]
        .map((path) => "https://manhole-techo.com" + path)
        .sort(),
    );
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
      data.cards[0].image = image;
      const pages = renderStaticPages(data, undefined, built);
      const page = doc(pages.get("card/TEST-TOKYO-1/index.html")!);
      const figures = page.querySelectorAll("main figure");
      expect(figures).toHaveLength(1);
      const img = figures[0].querySelector("img")!;
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
      expect(figures[0].querySelector("figcaption")?.textContent).toBe(
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
    },
  );
  it("leads with the place and the kind of card, the state in words, then the counters under one heading", () => {
    const data = sample();
    data.cards[0].image = image;
    const page = doc(
      renderStaticPages(data, undefined, built).get(
        "card/TEST-TOKYO-1/index.html",
      )!,
    );
    expect(page.querySelectorAll("h1")).toHaveLength(1);
    expect(page.querySelector("h1")?.textContent).toBe(
      "東京都合成テスト：東京Aのマンホールカード",
    );
    const facts = [
      ...page.querySelectorAll(".card-facts > :not(.card-places)"),
    ].map((element) => element.textContent);
    expect(facts).toEqual([
      "配布状態",
      "終了",
      "カード番号",
      "TEST-TOKYO-1",
      "弾",
      "テスト",
      "発行日",
      "2000/01/01",
      "配布場所",
    ]);
    expect(
      [...page.querySelectorAll("main :is(h2, h3)")].map(
        (heading) => `${heading.tagName} ${heading.textContent}`,
      ),
    ).toEqual(["H2 合成テスト共同配布所", "H2 合成テスト休日配布所"]);
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
    data.cards[0].id = "13-100 F001";
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
    expect(page.querySelector(".card-places")?.textContent).toContain(
      "配布場所の登録なし",
    );
    expect(html).not.toMatch(/\/api\/|memo|receivedOn|session/);
    // A card with no earlier number carries none.
    expect(
      doc(pages.get("card/TEST-OSAKA/index.html")!)
        .querySelector("#card-record")!
        .hasAttribute("data-card-aliases"),
    ).toBe(false);
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
// The page is the card's own: its prefecture is one step up the breadcrumbs.
it("lists no other cards on a card's page", () => {
  const data = sample();
  const card = data.cards[0];
  const page = doc(renderStaticPages(data).get(`card/${card.id}/index.html`)!);
  expect(page.querySelector('main a[href^="/card/"]')).toBeNull();
});

it("links generated card pages to extensionless site documents", () => {
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
