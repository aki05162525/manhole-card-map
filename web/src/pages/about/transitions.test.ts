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
it("蓋は2KB未満、12刻みを順に描き中央の印を最後に置く", () => {
  const html = renderToStaticMarkup(createElement(AboutLid));
  expect(Buffer.byteLength(html)).toBeLessThan(2048);
  expect(html.match(/<circle/g)).toHaveLength(3);
  expect(html.match(/class="lid-tick"/g)).toHaveLength(12);
  const css = read("./about.css");
  expect(css).toContain("animation: about-draw");
  expect(css).toContain("animation: about-stamp");
  expect(css).toContain("1180ms");
  expect(css).toContain("animation-timeline: view()");
  expect(css).toContain("word-break: keep-all");
  expect(css).toContain("grid-template-columns: 9rem");
  const transition = read("../../shared/ui/document-transitions.css");
  expect(transition).toContain("::view-transition-old(site-band)");
  expect(transition).toContain("object-fit: none");
  expect(transition).toMatch(
    /::view-transition-old\(site-band\)\s*\{\s*display: none/,
  );
  expect(transition).not.toMatch(
    /::view-transition-group\(site-band\)\s*\{\s*animation: none/,
  );
  expect(transition).toContain("rotate(30deg)");
});

it("文書の初期描画を終えてから遷移のスナップショットを取る", () => {
  for (const name of ["about", "cards", "404"]) {
    const html = read(`../../../${name}.html`);
    expect(html).toContain('blocking="render"');
    expect(html).toContain('rel="expect"');
  }
  expect(read("../../shared/browser/render-document.tsx")).toContain(
    "flushSync",
  );
});

it("PCは蓋・縦のキャッチ・中央のh1の3列にして空きを分散する", () => {
  const css = read("./about.css");
  expect(css).toContain("grid-template-columns: 240px auto minmax(0, 1fr)");
  expect(css).toContain("display: contents");
  expect(css).toContain("grid-column: 3");
  expect(css).toContain("grid-column: 2");
});
