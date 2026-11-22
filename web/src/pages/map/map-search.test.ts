import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { publicViews, type SearchFile } from "../../domain/public-views";
import type { Data } from "../../domain/types";
import { MapSearch, type MapSearchProps } from "./map-search";
import { searchSession } from "./map-search-state";

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
const index = publicViews(data)["search.json"] as SearchFile;
const markup = (overrides: Partial<MapSearchProps> = {}) =>
  renderToStaticMarkup(
    createElement(MapSearch, {
      index,
      dataError: "",
      onRetry() {},
      pref: undefined,
      session: searchSession(),
      onSelect() {},
      onOpen() {},
      onClose() {},
      onClosed() {},
      onUpdate() {},
      ...overrides,
    }),
  );
it("does not expand all cards for empty or whitespace input", () => {
  for (const query of ["", "  "])
    expect(markup({ session: searchSession({ query }) })).not.toContain(
      "観光の長い名称",
    );
});
it("lists every match in the catalog's order, unpinned cards included, up to the session's limit", () => {
  const html = markup({
    session: searchSession({ query: "観光", limit: 100 }),
  });
  expect(
    Array.from(html.matchAll(/data-card="([^"]+)"/g), (match) => match[1]),
  ).toEqual(index.cards.map((card) => card.id));
});
it("offers a retry only for a data failure, and never disables the search", () => {
  const ready = markup();
  expect(ready).not.toContain("disabled");
  expect(ready).not.toContain("再試行");
  const loading = markup({ index: null });
  expect(loading).not.toContain("disabled");
  // The loading line waits for a late answer (`shared/ui/delayed.tsx`).
  expect(loading).not.toContain("読み込み中");
  const failed = markup({ index: null, dataError: "取得失敗" });
  expect(failed).not.toContain("disabled");
  expect(failed).toContain("再試行");
  expect(failed).toContain('aria-live="polite"');
});
