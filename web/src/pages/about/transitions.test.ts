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
  expect(motion).toContain("3180ms");
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

it("閉じた表紙は背・蓋の紋・しおりを描き、枠の中央から綴じ目へ畳みながら左右へ均等に開く", () => {
  const html = renderToStaticMarkup(createElement(AboutLid));
  const cover = html.slice(
    html.indexOf('<g class="about-notebook-cover"'),
    html.indexOf("</g>"),
  );
  // The lid on the cover repeats the ring, dots and square of the card inside.
  expect(cover.match(/<circle/g)).toHaveLength(2);
  expect(cover).toContain('stroke-dasharray=".32 .892"');
  expect(cover.match(/fill="currentColor"/g)).toHaveLength(2);
  expect(cover).toContain('fill-opacity=".35"');
  const css = read("./about.css");
  const [, motion] = css.split(
    "@media (prefers-reduced-motion: no-preference)",
  );
  expect(css).toMatch(
    /@keyframes about-close-cover\s*\{[^}]+\}\s*to\s*\{\s*opacity: 0;\s*transform: scaleX\(0\);/,
  );
  expect(motion).toMatch(
    /\.about-notebook-cover\s*\{[^}]*transform-origin: left center/,
  );
  // The cover spans x=16..30 of the 32-wide box: (16 - 23) / 32.
  expect(css).toMatch(
    /@keyframes about-centre\s*\{\s*from\s*\{\s*translate: -21\.875%;/,
  );
  expect(motion).toMatch(
    /\.about-lid\s*\{\s*animation: about-centre 800ms[^;]+600ms\s+backwards/s,
  );
});

it("閉じた表紙を見せてから600ms後に800msかけて綴じ目を軸に開き、表紙は完成形に残さない", () => {
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
  expect(motion).toMatch(/animation: about-open 800ms[^;]+600ms\s+backwards/s);
  expect(motion).toMatch(
    /animation: about-close-cover 800ms[^;]+600ms\s+backwards/s,
  );
  expect(css).toMatch(
    /@keyframes about-close-cover\s*\{\s*from\s*\{\s*opacity: 1;\s*\}\s*to\s*\{\s*opacity: 0;/,
  );
  expect(motion).toContain("3180ms");
  expect(motion).not.toContain("infinite");
  // Paused until the page is ready and the cover is in view.
  expect(motion).toMatch(
    /\.about-lid:not\(\.is-playing\)[\s\S]*animation-play-state: paused/,
  );
});
