import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { Logo, Wordmark } from "./logo";

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
it("draws every letter of the site's name apart, solid or as faces inside a wider line", () => {
  const name = "マンホール手帳";
  const draw = (props: { outlined?: boolean } = {}) => {
    const html = renderToStaticMarkup(createElement(Wordmark, props));
    return {
      html,
      // One group for each letter, holding its strokes.
      letters: html.match(/<g transform="[^"]*">.*?<\/g>/g) ?? [],
      line: Number(/<g stroke-width="([\d.]+)"/.exec(html)?.[1]),
    };
  };
  const solid = draw();
  expect(solid.html).toContain(`role="img" aria-label="${name}"`);
  expect(solid.letters).toHaveLength(name.length);
  expect(
    new Set(
      solid.letters.map((letter) => /transform="[^"]*"/.exec(letter)?.[0]),
    ).size,
  ).toBe(solid.letters.length);
  for (const letter of solid.letters) {
    expect(letter).toContain("<path");
    expect(letter).not.toContain('d=""');
  }
  // The view box has the proportions the drawing is shown at.
  const size =
    /width="(\d+)" height="(\d+)" viewBox="\S+ \S+ (\d+) (\d+)"/.exec(
      solid.html,
    );
  expect(size).not.toBeNull();
  expect(size?.slice(1, 3)).toEqual(size?.slice(3, 5));
  expect(solid.html).not.toContain("wordmark-face");
  const outlined = draw({ outlined: true });
  expect(outlined.letters).toHaveLength(solid.letters.length * 2);
  expect(outlined.line).toBeGreaterThan(solid.line);
  const face = /class="wordmark-face" stroke-width="([\d.]+)"/.exec(
    outlined.html,
  );
  expect(Number(face?.[1])).toBeLessThan(outlined.line);
});
