import { describe, expect, it } from "vitest";
import {
  mapSearchScreen,
  readMapSearch,
  restoreMapSearch,
  searchSession,
  withMapSearch,
} from "./map-search-state";
it("keeps search exclusive from detail and preserves unrelated history", () => {
  const session = searchSession({
    query: "三島",
    limit: 100,
    scroll: 230,
    selected: "id",
  });
  expect(mapSearchScreen({ ...session, phase: "search" }, "id")).toBe("S");
  expect(mapSearchScreen({ ...session, phase: "detail" }, "id")).toBe("D");
  expect(mapSearchScreen(session, null)).toBe("M");
  expect(
    withMapSearch({ extra: 1, mapFocus: { pref: "静岡県" } }, session),
  ).toMatchObject({
    extra: 1,
    mapFocus: { pref: "静岡県" },
    mapSearch: session,
  });
});

describe("readMapSearch", () => {
  it("fills fields an older entry lacks and keeps the ones it has", () => {
    expect(
      readMapSearch({ mapSearch: { query: "三島", limit: 100, scroll: 30 } }),
    ).toEqual(searchSession({ query: "三島", limit: 100, scroll: 30 }));
  });
  it.each([
    ["no state", null],
    ["a string", "mapSearch"],
    ["an array", [{ query: "三島" }]],
    ["no search", { mapFocus: { area: null, pref: null } }],
    ["a search that is not an object", { mapSearch: "三島" }],
    ["a search that is an array", { mapSearch: ["三島"] }],
  ])("starts over from %s", (_, state) => {
    expect(readMapSearch(state)).toEqual(searchSession());
  });
  it("returns each unknown or out-of-range field to its default", () => {
    expect(
      readMapSearch({
        mapSearch: {
          phase: "old",
          query: "三島",
          limit: -1,
          scroll: Number.NaN,
          selected: 7,
          owner: {},
          restore: "yes",
        },
      }),
    ).toEqual(searchSession({ query: "三島" }));
  });
  it.each([0, 49, 50.5, Infinity, "100"])(
    "shows one page for a limit of %s",
    (limit) => {
      expect(readMapSearch({ mapSearch: { query: "三島", limit } }).limit).toBe(
        50,
      );
    },
  );
  it.each([-1, Infinity, "30"])(
    "starts at the top for a scroll of %s",
    (scroll) => {
      expect(readMapSearch({ mapSearch: { query: "", scroll } }).scroll).toBe(
        0,
      );
    },
  );
  it("keeps a valid field next to a broken one", () => {
    expect(
      readMapSearch({
        mapSearch: {
          phase: "search",
          query: null,
          limit: 150,
          selected: "id",
          owner: "tab",
          restore: true,
        },
      }),
    ).toEqual(
      searchSession({
        phase: "search",
        limit: 150,
        selected: "id",
        owner: "tab",
        restore: true,
      }),
    );
  });
});

describe("restoreMapSearch", () => {
  const typed = searchSession({
    phase: "search",
    query: "三島",
    limit: 100,
    scroll: 230,
    selected: "id",
    owner: "tab",
  });
  it("leaves a sheet-only entry as it is", () => {
    expect(
      restoreMapSearch({
        traversed: true,
        arrived: { url: "/?card=id", search: typed },
        shown: { url: "/?card=id", search: { ...typed } },
        latest: typed,
      }),
    ).toBeNull();
  });
  it("restores on mount even when nothing changed", () => {
    expect(
      restoreMapSearch({
        traversed: false,
        arrived: { url: "/", search: searchSession() },
        shown: { url: "/", search: searchSession() },
        latest: searchSession(),
      }),
    ).toEqual({ search: searchSession(), write: false });
  });
  it("carries the search typed last to a map entry and writes it there", () => {
    const arrived = searchSession({ owner: "tab", query: "古い" });
    expect(
      restoreMapSearch({
        traversed: true,
        arrived: { url: "/", search: arrived },
        shown: { url: "/", search: typed },
        latest: typed,
      }),
    ).toEqual({
      search: {
        ...arrived,
        query: "三島",
        limit: 100,
        scroll: 230,
        selected: "id",
      },
      write: true,
    });
  });
  it("does not write a map entry that already holds the search typed last", () => {
    const arrived = { ...typed, phase: "map" as const };
    expect(
      restoreMapSearch({
        traversed: true,
        arrived: { url: "/", search: arrived },
        shown: { url: "/", search: typed },
        latest: typed,
      }),
    ).toEqual({ search: arrived, write: false });
  });
  it("brings a search entry back to its saved list position", () => {
    const arrived = { ...typed, query: "古い" };
    expect(
      restoreMapSearch({
        traversed: true,
        arrived: { url: "/", search: arrived },
        shown: { url: "/", search: searchSession() },
        latest: searchSession(),
      }),
    ).toEqual({ search: { ...arrived, restore: true }, write: true });
    expect(
      restoreMapSearch({
        traversed: true,
        arrived: { url: "/", search: { ...arrived, restore: true } },
        shown: { url: "/", search: searchSession() },
        latest: searchSession(),
      }),
    ).toEqual({ search: { ...arrived, restore: true }, write: false });
  });
  it("shows a detail entry from search as it was written", () => {
    const arrived = { ...typed, phase: "detail" as const, query: "古い" };
    expect(
      restoreMapSearch({
        traversed: true,
        arrived: { url: "/?card=id", search: arrived },
        shown: { url: "/", search: typed },
        latest: typed,
      }),
    ).toEqual({ search: arrived, write: false });
  });
});
