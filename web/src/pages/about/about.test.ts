import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { AboutPage } from "./about-page";
import { credits } from "./about-credits";

it("aboutは地図の実行を必要とせず、h1は1つで折りたたみを開いたままにしない", () => {
  const html = renderToStaticMarkup(createElement(AboutPage));
  expect(html).not.toMatch(/<script|\/data\/|\/src\/main/);
  expect(html.match(/<h1[ >]/g)).toHaveLength(1);
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
