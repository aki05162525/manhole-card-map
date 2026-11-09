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
  expect(read("./site-header.css")).toMatch(
    /\.site-header nav a\s*\{\s*color: var\(--iron\)/,
  );
});
it("keeps compact hit targets, shared geometry and enlarged-text actions", () => {
  const map = read("../../pages/map/style.css");
  const search = read("../../pages/map/map-search.css");
  const detail = read("../../features/card-detail/detail-content.css");
  expect(map).not.toContain("min-height: 32px");
  expect(detail).not.toContain("min-height: 32px");
  expect(search).not.toMatch(/round 12px|border-radius: (8|12)px/);
  expect(map).toContain("width: var(--control-height-compact)");
  expect(map).toContain("border-inline: 0");
  expect(detail).toContain("@container sheet-actions (max-width: 22rem)");
  expect(detail).toContain("grid-column: 1 / -1");
  // The second row pairs two secondary actions; they share one height.
  expect(detail.slice(detail.indexOf("@container sheet-actions"))).toMatch(
    /\.destination-actions\s*\{[^}]*display: grid/s,
  );
  expect(detail).not.toMatch(
    /destination-actions button\s*\{[^}]*font-size: var\(--text-12\)/s,
  );
  expect(read("../../features/map/mapcn.css")).not.toContain("shadow-sm!");
  for (const path of [
    "./status-chip.tsx",
    "./search-feedback.tsx",
    "../../features/card-detail/destination-symbol.tsx",
    "../../pages/about/about-page.tsx",
  ])
    expect(read(path)).not.toContain('rx="1"');
});
it("shares control heights, type scale and transition timing", () => {
  const map = read("../../pages/map/style.css");
  const search = read("../../pages/map/map-search.css");
  const detail = read("../../features/card-detail/detail-content.css");
  expect(search).toContain("min-height: var(--control-height)");
  expect(search).toContain("calc(var(--radius-surface) - 6px)");
  expect(search).toMatch(/\.search-row-heading\s*\{[^}]*align-items: center/s);
  expect(map).toMatch(
    /\.card-map-controls\s*\{[^}]*right: 16px;[^}]*width: 48px/s,
  );
  expect(map).toContain("opacity var(--sheet-open) var(--sheet-open-easing)");
  expect(detail).toContain("line-height: var(--leading-control)");
  for (const css of [map, detail]) {
    expect(css).not.toMatch(
      /font-size: (13px|0\.9375rem|1\.25rem)|font-weight: 650/,
    );
  }
  for (const file of [
    "../../pages/cards/cards.css",
    "../../pages/about/about.css",
  ]) {
    const css = read(file);
    expect(css).not.toContain("font-size: var(--text-display)");
    expect(css).not.toContain("font-weight: 800");
  }
});
