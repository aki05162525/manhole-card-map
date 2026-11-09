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
it("手帳の線画は2KB以内で9段階を描き、完成時に線のdashを残さない", () => {
  const html = renderToStaticMarkup(createElement(AboutLid));
  expect(Buffer.byteLength(html)).toBeLessThanOrEqual(2048);
  for (let step = 1; step <= 9; step++)
    expect(html).toContain(`data-step="${step}"`);
  expect(html).not.toContain("<style");
  const css = read("./about.css");
  const motion = css.slice(
    css.indexOf("@media (prefers-reduced-motion: no-preference)"),
  );
  expect(motion).toContain("animation: about-draw");
  expect(motion).toContain("2480ms");
  expect(motion).toContain("backwards");
  expect(motion).not.toContain("forwards");
  expect(css.slice(0, css.indexOf("@keyframes about-draw"))).not.toContain(
    "stroke-dashoffset: 100",
  );
  expect(css).toContain("animation-timeline: view()");
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

it("閉じた表紙から200ms後に綴じ目を軸に開き、表紙は完成形に残さない", () => {
  const html = renderToStaticMarkup(createElement(AboutLid));
  expect(html).toContain('class="about-notebook-cover"');
  expect(html).toContain('class="about-notebook-left"');
  expect(html).toContain('class="about-notebook-right"');
  const css = read("./about.css");
  const [staticCss, motion] = css.split(
    "@media (prefers-reduced-motion: no-preference)",
  );
  expect(staticCss).toMatch(/\.about-notebook-cover\s*\{\s*opacity: 0;/);
  expect(staticCss).toMatch(
    /@keyframes about-open\s*\{\s*from\s*\{\s*transform: scaleX\(0\)/,
  );
  expect(motion).toContain("transform-box: fill-box");
  expect(motion).toContain("transform-origin: right center");
  expect(motion).toMatch(/animation: about-open 500ms[^;]+200ms\s+backwards/s);
  expect(motion).toMatch(
    /animation: about-close-cover 500ms[^;]+200ms\s+backwards/s,
  );
  expect(css).toMatch(
    /@keyframes about-close-cover\s*\{\s*from\s*\{\s*opacity: 1;\s*\}\s*to\s*\{\s*opacity: 0;/,
  );
  expect(motion).toContain("2480ms");
  expect(motion).not.toContain("infinite");
});
