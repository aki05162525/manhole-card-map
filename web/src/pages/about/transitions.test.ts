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

it("閉じた表紙は背・蓋の紋・しおりを描き、右ページの上に紙の色で重ねる", () => {
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
  // Painted after the right page and filled, so the turning cover hides it.
  expect(html.indexOf('class="about-notebook-right"')).toBeLessThan(
    html.indexOf('class="about-notebook-cover"'),
  );
  expect(read("./about.css")).toMatch(
    /\.about-notebook-cover\s*\{[^}]*fill: var\(--paper\)/,
  );
});

it("表紙が綴じ目で立つまで畳まれ、同じ時点から左ページが開く", () => {
  const css = read("./about.css");
  const [, motion] = css.split(
    "@media (prefers-reduced-motion: no-preference)",
  );
  const knots = (name: string) => {
    const from = css.indexOf(`@keyframes ${name} {`);
    return [
      ...css
        .slice(from, css.indexOf("\n}\n", from))
        .matchAll(
          /(from|to|[\d.]+%)\s*\{\s*transform: scaleX\(([\d.]+)\) skewY\((-?[\d.]+)deg\)/g,
        ),
    ].map(([, at, width, lift]) => ({
      at: at === "from" ? 0 : at === "to" ? 100 : Number.parseFloat(at),
      width: Number(width),
      lift: Number(lift),
    }));
  };
  const fold = knots("about-fold-cover");
  const open = knots("about-open");
  expect(fold[0]).toEqual({ at: 0, width: 1, lift: 0 });
  expect(open.at(-1)).toEqual({ at: 100, width: 1, lift: 0 });
  for (let i = 1; i < fold.length; i++)
    expect(fold[i].width).toBeLessThanOrEqual(fold[i - 1].width);
  for (let i = 1; i < open.length; i++)
    expect(open[i].width).toBeGreaterThanOrEqual(open[i - 1].width);
  // One leaf: the cover reaches its edge exactly where the left page leaves it.
  const edge = fold.find((knot) => knot.width === 0)!;
  const start = open.filter((knot) => knot.width === 0).at(-1)!;
  expect(start.at).toBe(edge.at);
  // The free edge is lifted the same way on both sides of the spine.
  expect(edge.lift).toBeLessThan(0);
  expect(start.lift).toBe(-edge.lift);
  // steps(2, jump-none) hides the cover at 50%; it must be on edge by then.
  expect(edge.at).toBeLessThanOrEqual(50);
  expect(motion).toMatch(
    /\.about-notebook-cover\s*\{[^}]*transform-origin: left center[^}]*animation-name: about-close-cover, about-fold-cover;\s*animation-timing-function: steps\(2, jump-none\), linear;/,
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
