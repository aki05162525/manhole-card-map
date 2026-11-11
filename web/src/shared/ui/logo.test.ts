import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { Logo } from "./logo";

it("uses the simplified notebook through 16px and the taped card above it", () => {
  for (const size of [12, 16, 17, 24, 32]) {
    const html = renderToStaticMarkup(createElement(Logo, { size }));
    expect(html).toContain('viewBox="0 0 32 32"');
    expect(html).toContain('stroke="currentColor"');
    expect(html).toContain('fill="currentColor"');
    expect(html).toContain('aria-hidden="true"');
    expect(html).not.toContain("<style");
    expect(html.includes('fill-opacity=".35"')).toBe(size > 16);
    expect(html.includes('stroke-width="2.8"')).toBe(size <= 16);
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
