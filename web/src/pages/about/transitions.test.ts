import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AboutLid } from "./about-lid";
const read = (path: string) =>
  readFileSync(new URL(path, import.meta.url), "utf8");
it("文書間遷移は共通CSSを全HTMLで読み、動きを許す時だけ有効にする", () => {
  const css = read("../../shared/ui/document-transitions.css");
  expect(css).toMatch(
    /@media\s*\(prefers-reduced-motion: no-preference\)\s*\{\s*@view-transition\s*\{\s*navigation: auto/,
  );
  expect(css).toContain("180ms");
  expect(
    [...css.matchAll(/view-transition-name:\s*([^;]+)/g)].map((m) => m[1]),
  ).toEqual(["site-band", "site-logo"]);
  expect(css).not.toContain("canvas");
  for (const file of ["index", "cards", "about", "404"])
    expect(read(`../../../${file}.html`)).toContain(
      "/src/shared/ui/document-transitions.css",
    );
});
it("自作の蓋は2KB未満で同心円3重と放射24本、格子を持つ", () => {
  const html = renderToStaticMarkup(createElement(AboutLid));
  expect(Buffer.byteLength(html)).toBeLessThan(2048);
  expect(html.match(/<circle/g)).toHaveLength(3);
  expect(html.match(/M/g)?.length).toBeGreaterThanOrEqual(32);
  const css = read("./about.css");
  expect(css).toContain("1.2s");
  expect(css).toMatch(/animation: about-draw 1.2s [^;]*backwards/);
  expect(css).toContain("writing-mode: vertical-rl");
  expect(css).toContain("@container");
});
