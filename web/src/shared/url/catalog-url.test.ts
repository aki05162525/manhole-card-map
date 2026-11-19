import { expect, it } from "vitest";
import {
  readCatalogUrl,
  cardPageUrl,
  catalogUrl,
  mapCardUrl,
  readMapCardUrl,
  mergeCatalogHistoryState,
} from "./catalog-url";

/** An issue naming the field and the value as given, with words for the visitor. */
const issue = (field: string, value: string) => ({
  field,
  value,
  message: expect.stringMatching(/\S/),
});

it("round trips encoded queries, prefectures, pages and card IDs", () => {
  const state = { pref: "13", q: "観光 & 施設", page: 12, card: "13-001-A001" };
  expect(readCatalogUrl(catalogUrl(state))).toEqual({ ...state, issues: [] });
  expect(readMapCardUrl(mapCardUrl("00-101-A001"))).toEqual({
    card: "00-101-A001",
    issues: [],
  });
  expect(readMapCardUrl("/")).toEqual({ card: null, issues: [] });
});

it("keeps a card ID within its own segment of the card page's path", () => {
  expect(cardPageUrl("13-001-A001")).toBe("/card/13-001-A001/");
  expect(cardPageUrl("../a b")).toBe("/card/..%2Fa%20b/");
});

it.each([
  [{ pref: null, q: "", page: 1, card: null }, "/cards"],
  [{ pref: "other", q: "", page: 1, card: null }, "/cards?pref=other"],
  [{ pref: null, q: " 三島 ", page: 1, card: null }, "/cards?q=三島"],
  [{ pref: null, q: "  ", page: 1, card: null }, "/cards"],
])("writes %j as %s, without the defaults", (state, url) => {
  expect(decodeURI(catalogUrl(state))).toBe(url);
});

it.each([
  ["?pref=other", { pref: "other" }],
  ["?q=%20%E4%B8%89%E5%B3%B6%20", { q: "三島" }],
  ["?page=1", { page: 1 }],
  ["?page=9007199254740991", { page: Number.MAX_SAFE_INTEGER }],
])("reads %s without an issue", (url, expected) => {
  expect(readCatalogUrl(url)).toEqual({
    pref: null,
    q: "",
    page: 1,
    card: null,
    ...expected,
    issues: [],
  });
});

it.each([
  ["pref", ""],
  ["page", "0"],
  ["page", "02"],
  ["page", "1.5"],
  ["page", "2.0"],
  ["page", "1e1"],
  ["page", " 2"],
  ["page", "Infinity"],
  ["page", "9007199254740992"],
  ["page", ""],
  ["card", ""],
  ["card", " "],
])("falls back from %s=%j with an issue", (field, value) => {
  expect(readCatalogUrl(new URLSearchParams({ [field]: value }))).toEqual({
    pref: null,
    q: "",
    page: 1,
    card: null,
    issues: [issue(field, value)],
  });
});

it("reports each invalid field of one URL, in the order pref, page, card", () => {
  const result = readCatalogUrl("/cards?card=missing&page=-2&pref=99", {
    cardIds: new Set(["exists"]),
  });
  expect(result).toMatchObject({ pref: null, page: 1, card: null });
  expect(result.issues).toEqual([
    issue("pref", "99"),
    issue("page", "-2"),
    issue("card", "missing"),
  ]);
});

it("takes the first of a repeated field and names every value given", () => {
  expect(readCatalogUrl("?pref=01&pref=13&q=a&q=b")).toEqual({
    pref: "01",
    q: "a",
    page: 1,
    card: null,
    issues: [issue("pref", "01, 13"), issue("q", "a, b")],
  });
});

it("checks the page and the card against the data once it is known", () => {
  const cardIds = new Set(["13-001-A001"]);
  expect(readCatalogUrl("?page=2", { totalPages: 2 })).toMatchObject({
    page: 2,
    issues: [],
  });
  expect(readCatalogUrl("?page=3", { totalPages: 2 })).toMatchObject({
    page: 1,
    issues: [issue("page", "3")],
  });
  // An empty list still has its first page.
  expect(readCatalogUrl("?page=1", { totalPages: 0 }).issues).toEqual([]);
  expect(readCatalogUrl("?card=13-001-A001", { cardIds })).toMatchObject({
    card: "13-001-A001",
    issues: [],
  });
  expect(readCatalogUrl("?card=13-001-A002", { cardIds })).toMatchObject({
    card: null,
    issues: [issue("card", "13-001-A002")],
  });
});

it("does not throw on a malformed escape", () => {
  expect(readCatalogUrl("?q=%E0%A4%A").q).toBeTruthy();
});

it("reads only the card of a map URL", () => {
  const cardIds = new Set(["yes"]);
  expect(readMapCardUrl("/?pref=99&page=0&card=yes", cardIds)).toEqual({
    card: "yes",
    issues: [],
  });
  expect(readMapCardUrl("/?card=no", cardIds)).toEqual({
    card: null,
    issues: [issue("card", "no")],
  });
  expect(readMapCardUrl("/?card=a&card=b")).toEqual({
    card: "a",
    issues: [issue("card", "a, b")],
  });
});

it("merges catalog ownership into history without losing or mutating mapFocus", () => {
  const state = Object.freeze({
    mapFocus: { area: "kanto", pref: "東京都" },
    another: 1,
  });
  const merged = mergeCatalogHistoryState(state, { card: "13-001-A001" });
  expect(merged).toEqual({ ...state, catalog: { card: "13-001-A001" } });
  expect(merged).not.toBe(state);
  for (const stored of [null, undefined, "text", 1])
    expect(mergeCatalogHistoryState(stored, { card: null })).toEqual({
      catalog: { card: null },
    });
});
