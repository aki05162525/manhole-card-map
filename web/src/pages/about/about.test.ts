import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { AboutPage } from "./about-page";
import { AUTHOR, credits } from "./about-credits";

it("aboutに使い方と主要なクレジットをまとめ、地図の実行を必要としない", () => {
  const html = renderToStaticMarkup(createElement(AboutPage));
  for (const text of [
    "マンホール手帳",
    "受け取る",
    "訪ねる",
    "ご利用にあたって",
    "クレジット",
    "GKP",
    "国土数値情報",
    "国土地理院",
    "ABR",
    "登記所備付地図",
    "CARTO",
    "OpenStreetMap",
  ])
    expect(html.replace(/<[^>]*>/g, "")).toContain(text);
  expect(html).not.toMatch(/<script|\/data\/|\/src\/main/);
  expect(html.match(/<h1[ >]/g)).toHaveLength(1);
  expect(html).toContain(`${AUTHOR}が加工して作成`);
  expect(html).toContain(
    "配布場所の位置は、各施設の公式案内や公的データなどの公開情報をもとに独自に整理したものです。",
  );
  expect(html).not.toMatch(/マンホール手帳\s*が/);
  expect(html).not.toMatch(/<details[^>]*open/);
});

it("出典の名称・URL・ライセンス情報を表示し、URLが重複しない", () => {
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
    credits.indexOf("<dt>配布場所の位置</dt>"),
    credits.indexOf("<dt>背景地図</dt>"),
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

it("修正や削除の依頼先として連絡先を示す", () => {
  const html = renderToStaticMarkup(createElement(AboutPage));
  expect(html).toContain("お問い合わせ");
  expect(html).toContain('href="mailto:contact@manhole-techo.com"');
  expect(html).toContain("修正・削除");
  expect(html.indexOf("お問い合わせ")).toBeLessThan(html.indexOf("クレジット"));
});
