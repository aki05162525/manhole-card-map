import { readFileSync } from "node:fs";
import { expect, test } from "vitest";

for (const [file, path, title] of [
  ["index", "/", "マンホールカード地図｜全国の配布場所マップ - マンホール手帳"],
  [
    "cards",
    "/cards",
    "マンホールカード一覧｜都道府県別の配布場所 - マンホール手帳",
  ],
  ["about", "/about", "マンホール手帳について｜マンホールカード地図の使い方"],
  ["404", "/404", "ページが見つかりません | マンホール手帳"],
]) {
  test(`${file} search and sharing metadata`, () => {
    const doc = new DOMParser().parseFromString(
      readFileSync(`${file}.html`, "utf8"),
      "text/html",
    );
    const meta = (key: string) =>
      doc
        .querySelector(`meta[name="${key}"],meta[property="${key}"]`)
        ?.getAttribute("content");
    expect(doc.title).toBe(title);
    expect(meta("description")).toBeTruthy();
    expect(meta("description")).not.toContain("検証用");
    expect(
      doc.querySelector('link[rel="canonical"]')?.getAttribute("href"),
    ).toBe(`https://manhole-techo.com${path}`);
    expect(meta("og:title")).toBe(title);
    expect(meta("og:description")).toBe(meta("description"));
    expect(meta("og:url")).toBe(`https://manhole-techo.com${path}`);
    expect(meta("og:site_name")).toBe("マンホール手帳");
    expect(meta("og:locale")).toBe("ja_JP");
    expect(meta("og:type")).toBe("website");
    expect(meta("og:image")).toBe("https://manhole-techo.com/og-image.png");
    expect(meta("twitter:card")).toBe("summary_large_image");
    expect(meta("robots")).toBe(file === "404" ? "noindex" : undefined);
    if (file === "index") {
      expect(meta("description")).toContain("全国__CARD_COUNT__枚");
      const graph = JSON.parse(
        doc.querySelector('script[type="application/ld+json"]')!.textContent!,
      );
      expect(graph["@context"]).toBe("https://schema.org");
      expect(
        graph["@graph"].map((x: { "@type": string }) => x["@type"]),
      ).toEqual(["WebSite", "WebApplication"]);
      expect(graph["@graph"][1].offers.price).toBe("0");
      expect(graph["@graph"][0].alternateName).toBe("マンホールカード地図");
    }
  });
}
test("map has one accessible topic heading", () => {
  const source = readFileSync("src/pages/map/map-page.tsx", "utf8");
  expect(source.match(/<h1\b/g)).toHaveLength(1);
  expect(source).toContain(
    'className="map-search-sr-only">マンホールカード地図</h1>',
  );
});
