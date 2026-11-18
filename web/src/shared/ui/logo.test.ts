import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { Logo, Wordmark } from "./logo";
import { WORDMARK_GLYPHS } from "./wordmark-paths";

it("switches between the simplified notebook through 16px and the taped card above it", () => {
  for (const size of [12, 16, 17, 24, 32]) {
    const html = renderToStaticMarkup(createElement(Logo, { size }));
    expect(html.includes('fill-opacity=".35"')).toBe(size > 16);
    expect(html.includes('stroke-width="2.8"')).toBe(size <= 16);
    expect(html).not.toContain('stroke-dasharray="2 1.4"');
    expect(Buffer.byteLength(html)).toBeLessThanOrEqual(2048);
  }
});
it("uses a dashed card frame without tape for incomplete logos above 16px", () => {
  for (const size of [16, 24, 48, 96]) {
    const html = renderToStaticMarkup(
      createElement(Logo, { size, incomplete: true }),
    );
    expect(html.includes('stroke-dasharray="2 1.4"')).toBe(size > 16);
    expect(html).not.toContain("fill-opacity");
    expect(html).not.toContain("<style");
    expect(Buffer.byteLength(html)).toBeLessThanOrEqual(2048);
  }
});
it("draws the wordmark's letters apart, solid or as faces inside a wider line", () => {
  const strokes = WORDMARK_GLYPHS.flatMap(([, paths]) => paths).length;
  const draw = (props: { outlined?: boolean } = {}) => {
    const html = renderToStaticMarkup(createElement(Wordmark, props));
    return {
      html,
      paths: html.split("<path").length - 1,
      places: new Set(html.match(/transform="[^"]+"/g)).size,
      line: Number(/<g stroke-width="([\d.]+)"/.exec(html)?.[1]),
    };
  };
  const solid = draw();
  expect(solid.html).toContain('role="img" aria-label="マンホール手帳"');
  expect(solid.places).toBe(WORDMARK_GLYPHS.length);
  expect(solid.paths).toBe(strokes);
  expect(solid.html).not.toContain("wordmark-face");
  const outlined = draw({ outlined: true });
  expect(outlined.paths).toBe(strokes * 2);
  expect(outlined.line).toBeGreaterThan(solid.line);
  const face = /class="wordmark-face" stroke-width="([\d.]+)"/.exec(
    outlined.html,
  );
  expect(Number(face?.[1])).toBeLessThan(outlined.line);
});
