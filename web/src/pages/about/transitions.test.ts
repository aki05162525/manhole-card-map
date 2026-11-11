import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AboutLid } from "./about-lid";
const read = (path: string) =>
  readFileSync(new URL(path, import.meta.url), "utf8");
it("手帳の線画は2KB以内で9段階を描き、完成時に線のdashを残さない", () => {
  const html = renderToStaticMarkup(createElement(AboutLid));
  expect(Buffer.byteLength(html)).toBeLessThanOrEqual(2048);
  for (let step = 1; step <= 9; step++)
    expect(html).toContain(`data-step="${step}"`);
  expect(html).not.toContain("<style");
});

it("閉じた表紙を右ページの後に描き、めくる間は右ページを隠す", () => {
  const html = renderToStaticMarkup(createElement(AboutLid));
  // Painted after the right page and filled, so the turning cover hides it.
  expect(html.indexOf('class="about-notebook-right"')).toBeLessThan(
    html.indexOf('class="about-notebook-cover"'),
  );
});

it("表紙が綴じ目で立つまで畳まれ、同じ時点から左ページが開く", () => {
  const css = read("./about.css");
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
});
