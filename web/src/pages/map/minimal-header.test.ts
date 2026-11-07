import { expect, it } from "vitest";
import { readFileSync } from "node:fs";
it("connects catalog search and URL selection independently of map readiness", () => {
  const app = readFileSync(new URL("./app.tsx", import.meta.url), "utf8");
  expect(app).toContain("<MapSearch");
  expect(app).toContain("useMapUrlState");
  expect(app).toContain("createCardCatalog");
  expect(app).toContain("検証用の架空データ");
  expect(app).not.toContain("<SearchPanel");
});
it("measures the permanent bar rather than the modal dialog", () => {
  const app = readFileSync(new URL("./app.tsx", import.meta.url), "utf8");
  const map = readFileSync(
    new URL("../../features/map/card-map.tsx", import.meta.url),
    "utf8",
  );
  expect(app).toContain('querySelector(".map-search-bar")');
  expect(map).toContain('querySelector(".map-search-bar")');
  expect(map).toContain("detailElement?.offsetHeight");
  expect(map).not.toContain('querySelector(".map-search-dialog")');
  expect(app).toContain('className="detail-body"');
  expect(app).toContain('aria-label="閉じる"');
  expect(app).not.toContain("検索結果へ");
});

it("raises mobile controls above the bottom sheet", async () => {
  const { readFileSync } = await import("node:fs");
  const css = readFileSync(new URL("./style.css", import.meta.url), "utf8");
  expect(css).not.toContain(".has-detail .map-actions");
  expect(css).toContain(".has-detail #locate");
  expect(css).not.toContain("bottom: 32%");
  expect(css).toContain("max-height: 50dvh");
  expect(css).toContain("top: calc(var(--header-bottom) + 12px)");
  expect(css).not.toContain(".search-panel");
  expect(css).not.toContain(".sheet-handle");
});
