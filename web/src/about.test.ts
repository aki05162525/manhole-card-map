import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { AboutPage } from "./about-page";
import { AUTHOR, credits } from "./about-credits";
import { SearchPanel } from "./search-panel";

it("aboutに使い方と主要なクレジットをまとめ、地図の実行を必要としない", () => {
  const html = renderToStaticMarkup(createElement(AboutPage));
  for (const text of [
    "マンホール手帳",
    "できること",
    "ご利用にあたって",
    "クレジット",
    "GKP",
    "国土数値情報",
    "国土地理院",
    "ABR",
    "登記所備付地図",
    "CARTO",
    "OpenStreetMap",
    "MapLibre",
    "MAPCN_LICENSE.txt",
  ])
    expect(html).toContain(text);
  expect(html).not.toMatch(/<script|\/data\/|\/src\/main/);
  expect(html.match(/class="about-card"/g)).toHaveLength(3);
  expect(html).toContain(`${AUTHOR}が加工して作成`);
  expect(html).toContain(
    "配布場所の位置は、各施設の公式案内や公的データなどの公開情報をもとに独自に整理したものです。",
  );
  expect(html).not.toMatch(/マンホール手帳\s*が/);
  expect(html).not.toMatch(/<details[^>]*open/);
  expect(
    readFileSync(new URL("../index.html", import.meta.url), "utf8"),
  ).toContain("<title>マンホール手帳</title>");
});

it("データ・地図が使えなくてもパネルからaboutを開ける", () => {
  const noop = () => {};
  const html = renderToStaticMarkup(
    createElement(SearchPanel, {
      data: null,
      focus: { area: null, pref: null },
      onFocus: noop,
      loaded: false,
      fixture: false,
      query: "",
      filtered: [],
      showLids: false,
      placeCount: 0,
      notice: "地図を読み込めません",
      alert: "",
      open: true,
      canClose: false,
      onToggle: noop,
      onPickPrefecture: noop,
      dataError: true,
      onQuery: noop,
      onSelect: noop,
      onShowLids: noop,
    }),
  );
  expect(html).toContain("<h1>マンホール手帳</h1>");
  expect(html).toContain('href="/about.html"');
  for (const text of [
    "非公式",
    "在庫は未確認",
    "訪問前に公式情報",
    "■ 配布場所",
    "● 蓋",
  ])
    expect(html).toContain(text);
});

it("出典54件の名称・URL・ライセンス情報を保持し重複しない", () => {
  expect(credits).toHaveLength(54);
  expect(new Set(credits.map((credit) => credit.url)).size).toBe(
    credits.length,
  );
  const html = renderToStaticMarkup(createElement(AboutPage));
  for (const credit of credits) {
    expect(credit.name.trim()).not.toBe("");
    expect(credit.url).toMatch(/^https?:\/\//);
    expect(html).toContain(credit.name);
    expect(html).toContain(credit.url);
    if (credit.license) expect(html).toContain(credit.license);
    if (credit.licenseUrl) expect(html).toContain(credit.licenseUrl);
  }
});

it("配布場所の位置は一文だけ見せ、出典は1つの開閉式一覧へまとめる", () => {
  const html = renderToStaticMarkup(createElement(AboutPage));
  const credits = html.slice(html.indexOf('id="credits"'));
  const position = credits.slice(
    credits.indexOf("<h3>配布場所の位置</h3>"),
    credits.indexOf("<h3>背景地図</h3>"),
  );
  const visible = position.slice(0, position.indexOf("<details"));
  expect(visible).toContain("公開情報をもとに独自に整理したものです。");
  for (const source of ["国土数値情報", "地理院", "ABR", "N03"])
    expect(visible).not.toContain(source);
  expect(position.match(/<details/g)).toHaveLength(1);
  expect(position).toContain("<summary>使用した公開データの一覧</summary>");
  for (const source of [
    "国土数値情報",
    "最適化ベクトルタイル",
    "ABR",
    "N03",
    "ORIGAMI",
    "BODIK",
  ])
    expect(position.slice(position.indexOf("<details"))).toContain(source);
});

it("画面とaboutで自サイト配信のNoto Sans JPを使う", () => {
  const read = (path: string) =>
    readFileSync(new URL(path, import.meta.url), "utf8");
  for (const entry of ["./main.ts", "./about-main.tsx"])
    expect(read(entry)).toContain("@fontsource-variable/noto-sans-jp");
  for (const css of ["./style.css", "./about.css"])
    expect(read(css)).toContain('"Noto Sans JP Variable"');
  const html = renderToStaticMarkup(createElement(AboutPage));
  expect(html).toContain("Noto Sans JP");
  expect(html).toContain("/NOTO_SANS_JP_LICENSE.txt");
});
