import { expect, it } from "vitest";
import {
  readCatalogUrl,
  catalogUrl,
  mapCardUrl,
  readMapCardUrl,
  mergeCatalogHistoryState,
} from "./catalog-url";

it("round trips encoded queries, prefectures, pages and card IDs", () => {
  const state = { pref: "13", q: "観光 & 施設", page: 2, card: "13-001-A001" };
  expect(readCatalogUrl(catalogUrl(state))).toEqual({ ...state, issues: [] });
  expect(catalogUrl({ pref: "other", q: "", page: 1, card: null })).toBe(
    "/cards?pref=other",
  );
  expect(catalogUrl({ pref: null, q: "", page: 1, card: null })).toBe("/cards");
  expect(readMapCardUrl(mapCardUrl("00-101-A001"))).toEqual({
    card: "00-101-A001",
    issues: [],
  });
  expect(readMapCardUrl("/")).toEqual({ card: null, issues: [] });
});
it("returns explanatory issues without throwing on invalid and repeated values", () => {
  const result = readCatalogUrl("/cards?pref=99&page=-2&card=missing", {
    cardIds: new Set(["exists"]),
  });
  expect(result).toMatchObject({ pref: null, page: 1, card: null });
  expect(result.issues.map((i) => i.field)).toEqual(["pref", "page", "card"]);
  expect(result.issues.every((i) => i.message && i.value)).toBe(true);
  for (const page of ["0", "1.5", "Infinity", "9007199254740992", ""])
    expect(readCatalogUrl(`?page=${page}`).issues).toHaveLength(1);
  expect(readCatalogUrl("?page=3", { totalPages: 2 }).issues[0]?.field).toBe(
    "page",
  );
  expect(readCatalogUrl("?pref=01&pref=13").issues[0]?.field).toBe("pref");
  expect(readMapCardUrl("?card=no", new Set(["yes"])).issues[0]?.field).toBe(
    "card",
  );
  expect(readCatalogUrl("?q=%E0%A4%A").q).toBeTruthy();
});
it("merges catalog ownership into history without losing or mutating mapFocus", () => {
  const state = Object.freeze({
    mapFocus: { area: "kanto", pref: "東京都" },
    another: 1,
  });
  const merged = mergeCatalogHistoryState(state, { card: "13-001-A001" });
  expect(merged).toEqual({ ...state, catalog: { card: "13-001-A001" } });
  expect(merged).not.toBe(state);
  expect(mergeCatalogHistoryState(null, { card: null })).toEqual({
    catalog: { card: null },
  });
});
