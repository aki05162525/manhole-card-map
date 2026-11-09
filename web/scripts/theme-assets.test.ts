import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

it.each(["index", "cards", "about", "404"])(
  "%s declares both native schemes and separate browser chrome colors before styles load",
  (page) => {
    const html = readFileSync(
      new URL(`../${page}.html`, import.meta.url),
      "utf8",
    );
    expect(html).toContain('<meta name="color-scheme" content="light dark"');
    const colors = [...html.matchAll(/<meta\s+name="theme-color"[^>]*>/g)].map(
      (m) => m[0],
    );
    expect(colors).toHaveLength(2);
    expect(colors[0]).toContain('content="#f3f1ec"');
    expect(colors[0]).toContain('media="(prefers-color-scheme: light)"');
    expect(colors[1]).toContain('content="#141816"');
    expect(colors[1]).toContain('media="(prefers-color-scheme: dark)"');
    expect(html.indexOf('name="color-scheme"')).toBeLessThan(
      html.indexOf("<link"),
    );
  },
);
it("lets the favicon adapt its currentColor to the OS preference", () => {
  const svg = readFileSync(
    new URL("../public/favicon.svg", import.meta.url),
    "utf8",
  );
  expect(svg).toContain("prefers-color-scheme:dark");
  expect(svg).toContain('stroke="currentColor"');
  expect(svg).toContain('fill="currentColor"');
  expect(svg).not.toMatch(/(?:fill|stroke)="#/);
});
