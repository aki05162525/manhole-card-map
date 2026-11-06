import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { SourceNotes } from "./source-notes";

describe("採用位置の出典表示", () => {
  it("深谷市の版未指定CC-BYとGSI写真の加工元を表示する", () => {
    const html = renderToStaticMarkup(createElement(SourceNotes));
    expect(html).toContain("令和6年(2024)航空写真（ライト版）");
    expect(html).toContain("CC-BY、版の明示なし");
    expect(html).toContain("isopen=false");
    expect(html).toContain("全国最新写真");
    expect(html).toContain("PDL1.0");
    expect(html).toContain("manhole-card-mapが加工");
    expect(html).toContain("https://www.geospatial.jp/ckan/dataset/_-6-2024");
    expect(html).toContain(
      "https://www.gsi.go.jp/kikakuchousei/kikakuchousei40182.html",
    );
  });
});
