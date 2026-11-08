import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
const read = (file: string) =>
  readFileSync(new URL(file, import.meta.url), "utf8");
it("keeps the drag handle and breadcrumb buttons flat and the close control round", () => {
  const css = read("../../pages/map/style.css");
  for (const selector of [
    ".detail-actions button.detail-drag-handle",
    ".map-actions .breadcrumbs button",
  ]) {
    const rule = css.slice(css.indexOf(`${selector} {`)).split("}")[0];
    expect(rule).toContain("box-shadow: none");
  }
  const close = css
    .slice(css.indexOf(".detail-actions .detail-close {"))
    .split("}")[0];
  expect(close).toContain("border-radius: var(--radius-round)");
  expect(close).toContain("width: 44px");
});
it("covers the scroll padding beneath the opaque sticky actions and keeps missing fields intact", () => {
  const css = read("../../features/card-detail/detail-content.css");
  expect(css).toContain("bottom: calc(-1 * var(--detail-scroll-padding, 0px))");
  expect(css).toContain(
    "calc(var(--space-3) + var(--detail-scroll-padding, 0px))",
  );
  expect(css).toMatch(/\.missing-fields > span\s*\{\s*white-space: nowrap/);
  expect(css).toContain("0 -1px 0 var(--rule)");
  expect(css).toContain("grid-template-columns: minmax(0, 2fr) minmax(0, 1fr)");
});
it("uses phrase wrapping for headings and prelude and iron for both linked logos", () => {
  const css = read("./tokens.css");
  const supported = css
    .slice(css.indexOf("@supports (word-break: auto-phrase)"))
    .split("}")[0];
  for (const selector of [
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    ".detail-prelude",
  ])
    expect(supported).toContain(selector);
  expect(read("../../pages/map/style.css")).toMatch(
    /\.map-search-bar \.logo-link\s*\{\s*color: var\(--iron\)/,
  );
  expect(read("../../pages/cards/cards.css")).toMatch(
    /\.cards-page \.catalog-header \.catalog-brand\s*\{\s*color: var\(--iron\)/,
  );
});
