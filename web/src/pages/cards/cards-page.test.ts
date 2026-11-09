import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { fixtureData } from "../../../scripts/fixtures";
import { CardsPage } from "./cards-page";
const state = vi.hoisted(() => ({
  data: null as unknown,
  error: "",
  fixture: false,
}));
vi.mock("../../features/card-data/use-catalog-data", () => ({
  useCatalogData: () => ({ ...state, reload() {} }),
}));
it("shows loading and a retryable failure instead of an empty catalog", () => {
  const loading = renderToStaticMarkup(createElement(CardsPage));
  expect(loading).toContain("読み込み中");
  expect(loading).toContain('class="loading-logo"');
  const loadingLogo = loading
    .split('class="loading-logo"')[1]
    .split("</svg>")[0];
  expect(loadingLogo).toContain('stroke-dasharray="1.2 4.874"');
  state.error = "カード情報を読み込めませんでした。";
  const html = renderToStaticMarkup(createElement(CardsPage));
  expect(html).toContain(state.error);
  expect(html).toContain('class="data-error-banner"');
  expect(html).toContain("再読み込み");
  expect(html).not.toContain("0枚");
  state.error = "";
});
it("groups 47 prefectures into nine regions, keeps other separate and warns about fixtures", () => {
  state.data = fixtureData;
  state.fixture = true;
  const html = renderToStaticMarkup(createElement(CardsPage));
  expect(html.match(/data-pref=/g)).toHaveLength(48);
  expect(html.match(/class="catalog-region"/g)).toHaveLength(9);
  expect(html).toContain("その他（県の登録なし）");
  expect(html).toContain("検証用の架空データ");
  expect(html).toContain("在庫は保証されません");
  expect(html).not.toContain("● 蓋");
});
