import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AboutPage } from "./about-page";
import { AUTHOR } from "./about-credits";

describe("採用位置の出典表示", () => {
  it("ORIGAMIと桐生の写真年代・公式図・独自加工主体を表示する", () => {
    const html = renderToStaticMarkup(createElement(AboutPage)).replace(
      /\s+/g,
      " ",
    );
    for (const text of [
      "上三川町基本設計概要",
      "桐生市庁舎駐車場案内図",
      "2010年4月～5月",
      "2020年5月～8月",
      `${AUTHOR}が独自に位置合わせ`,
      "国土地理院・自治体が測量、同定又は承認した座標ではありません",
      "https://maps.gsi.go.jp/development/ichiran.html",
    ]) {
      expect(html).toContain(text);
    }
  });
  it("深谷市の版未指定CC-BYとGSI写真の加工元を表示する", () => {
    const html = renderToStaticMarkup(createElement(AboutPage)).replace(
      /\s+/g,
      " ",
    );
    expect(html).toContain("令和6年(2024)航空写真（ライト版）");
    expect(html).toContain("CC-BY、版の明示なし");
    expect(html).toContain("全国最新写真");
    expect(html).toContain("PDL1.0");
    expect(html).toContain(`${AUTHOR}が加工`);
    expect(html).toContain("https://www.geospatial.jp/ckan/dataset/_-6-2024");
    expect(html).toContain(
      "https://www.gsi.go.jp/kikakuchousei/kikakuchousei40182.html",
    );
  });
});

it("hides map symbols on request while keeping inventory guidance", async () => {
  const { SourceNotes } = await import("./source-notes");
  const html = renderToStaticMarkup(
    createElement(SourceNotes, { showLegend: false }),
  );
  expect(html).toContain("在庫は未確認");
  expect(html).not.toContain("legend");
  expect(renderToStaticMarkup(createElement(SourceNotes))).toContain(
    "■ 配布場所",
  );
});
