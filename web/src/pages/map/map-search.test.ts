import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { createCardCatalog } from "../../domain/card-catalog";
import type { Data } from "../../domain/types";
import { MapSearch, mapSearchResults } from "./map-search";

vi.mock("../../features/map/map-stage", () => {
  throw new Error("map unavailable");
});
const data: Data = {
  schema: 1,
  updated: "",
  places: [],
  relations: [],
  pins: [],
  cards: Array.from({ length: 58 }, (_, i) => ({
    id: `01-00${i}-A001`,
    pref: "北海道",
    city: `観光の長い名称${i}`,
    series: "",
    issued: "",
    acquired: "",
    status: "active",
    lid: { status: "unconfirmed" },
    placeText: null,
    hours: null,
    links: null,
  })),
};
const catalog = createCardCatalog(data);
it("does not expand all cards for empty or whitespace input", () => {
  expect(mapSearchResults(catalog, "")).toEqual({ cards: [], total: 0 });
  expect(mapSearchResults(catalog, "  ")).toEqual({ cards: [], total: 0 });
  const html = renderToStaticMarkup(
    createElement(MapSearch, { catalog, onSelect() {} }),
  );
  expect(html).not.toContain("観光の長い名称");
  expect(html).not.toContain("一覧で全件見る");
});
it("includes unpinned cards in normal order and returns nationwide results without a five-card slice", () => {
  const results = mapSearchResults(catalog, "観光");
  expect(results.total).toBe(58);
  expect(results.cards.map((c) => c.id)).toEqual(
    catalog.cards.map((c) => c.id),
  );
  expect(catalog.entriesById.get(results.cards[0].id)?.hasPin).toBe(false);
});
it("renders without map code and disables only for a data failure", () => {
  const ready = renderToStaticMarkup(
    createElement(MapSearch, { catalog, onSelect() {} }),
  );
  expect(ready).not.toContain("disabled");
  expect(ready).not.toContain("再読み込み");
  const loading = renderToStaticMarkup(
    createElement(MapSearch, { catalog: null, onSelect() {} }),
  );
  expect(loading).not.toContain("disabled");
  // The loading line waits for a late answer (`shared/ui/delayed.tsx`).
  expect(loading).not.toContain("読み込み中");
  const failed = renderToStaticMarkup(
    createElement(MapSearch, {
      catalog: null,
      dataError: "取得失敗",
      onSelect() {},
    }),
  );
  expect(failed).not.toContain("disabled");
  expect(failed).toContain("再読み込み");
  expect(failed).toContain('aria-live="polite"');
});
