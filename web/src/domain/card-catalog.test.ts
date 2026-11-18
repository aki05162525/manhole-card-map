import { describe, expect, it } from "vitest";
import type { Card, Data } from "./types";
import { createCardCatalog, catalogCards, paginateCards } from "./card-catalog";

function card(id: string, pref = "北海道"): Card {
  return {
    id,
    pref,
    city: id,
    series: "第1弾",
    issued: "",
    acquired: "",
    status: "active",
    lid: { status: "unconfirmed" },
    placeText: null,
    hours: null,
    links: null,
  };
}
function sample(): Data {
  const cards = [
    card("00-101-A001", ""),
    card("01-406-A001"),
    card("01-231-B001"),
    card("01-202-A001"),
    card("01-100-C001"),
    card("13-001-A001", "東京都"),
  ];
  return {
    schema: 1,
    updated: "",
    cards,
    places: [
      {
        id: "a",
        name: "窓口A",
        address: "埼玉県戸田市",
        phone: "",
        coordinate: { status: "confirmed", lat: 35, lng: 139 },
      },
      {
        id: "b",
        name: "窓口B",
        address: "",
        phone: "",
        coordinate: { status: "unconfirmed" },
      },
      {
        id: "c",
        name: "旧住所",
        address: "",
        phone: "",
        coordinate: { status: "unconfirmed" },
        locationReview: {
          status: "withdrawn",
          reason: "移転",
        },
      },
    ],
    relations: [
      ...["a", "a", "b"].map((placeId) => ({
        cardId: "01-100-C001",
        placeId,
        condition: "曜日条件",
        periodRaw: "期間",
        alternativeRaw: "",
        review: "verified" as const,
      })),
      {
        cardId: "01-202-A001",
        placeId: "a",
        condition: "",
        periodRaw: "",
        alternativeRaw: "",
        review: "needs-review",
      },
      {
        cardId: "01-406-A001",
        placeId: "c",
        condition: "",
        periodRaw: "",
        alternativeRaw: "",
      },
      {
        cardId: "00-101-A001",
        placeId: "a",
        condition: "",
        periodRaw: "",
        alternativeRaw: "",
      },
    ],
    pins: [
      {
        id: "a",
        pref: "北海道",
        kind: "place",
        cardIds: ["01-100-C001", "00-101-A001"],
        status: "active",
        lat: 35,
        lng: 139,
      },
      {
        id: "c",
        pref: "北海道",
        kind: "place",
        cardIds: ["01-406-A001"],
        status: "active",
        lat: 35,
        lng: 139,
      },
      {
        id: "lid:01-231-B001",
        pref: "北海道",
        kind: "lid",
        cardIds: ["01-231-B001"],
        status: "active",
        lat: 43,
        lng: 141,
      },
    ],
  };
}

describe("card catalog", () => {
  it("deduplicates facilities, classifies unavailable pins and counts other separately", () => {
    const catalog = createCardCatalog(sample());
    expect(catalog.cards.map((c) => c.id)).toEqual([
      "01-100-C001",
      "01-202-A001",
      "01-231-B001",
      "01-406-A001",
      "13-001-A001",
      "00-101-A001",
    ]);
    expect(catalog.entriesById.get("01-100-C001")).toMatchObject({
      facilitySummary: "窓口A ほか1施設",
      facilityCount: 2,
      hasPin: true,
      pinReasons: ["partial"],
    });
    // Every place of the card has a pin: nothing to explain.
    expect(catalog.entriesById.get("00-101-A001")).toMatchObject({
      hasPin: true,
      pinReasons: [],
    });
    expect(catalog.entriesById.get("01-202-A001")?.pinReasons).toEqual([
      "relation-review",
    ]);
    // A lid is not a place to receive the card at.
    expect(catalog.entriesById.get("01-231-B001")).toMatchObject({
      hasPin: false,
      pinReasons: ["no-facility"],
    });
    expect(catalog.entriesById.get("01-406-A001")?.pinReasons).toEqual([
      "location-unconfirmed",
    ]);
    const hokkaido = catalog.areas.find((a) => a.id === "hokkaido");
    expect(hokkaido?.prefectures).toEqual([
      { code: "01", name: "北海道", total: 4 },
    ]);
    expect(catalog.other).toEqual({
      code: "other",
      name: "その他（県の登録なし）",
      total: 1,
    });
    expect(catalog.total).toBe(6);
    expect(
      catalogCards(catalog, { pref: "other", q: "戸田市" }).map((c) => c.id),
    ).toEqual(["00-101-A001"]);
    expect(catalogCards(catalog, { pref: "13", q: "戸田市" })).toEqual([]);
  });
  it("handles no pins, unregistered relations, mixed reasons, and empty summaries", () => {
    const data = sample();
    data.pins = [];
    for (const placeId of ["b", "unregistered"])
      data.relations.push({
        cardId: "01-202-A001",
        placeId,
        condition: "",
        periodRaw: "",
        alternativeRaw: "",
      });
    const catalog = createCardCatalog(data);
    expect(catalog.entriesById.get("01-202-A001")).toMatchObject({
      facilitySummary: "窓口A ほか1施設",
      facilityCount: 2,
      hasPin: false,
      pinReasons: ["relation-review", "location-unconfirmed", "no-facility"],
    });
    expect(catalog.entriesById.get("01-231-B001")?.facilitySummary).toBe(
      "配布場所の登録なし",
    );
  });
  it("paginates by 50 without mutating cards, and shows the last page for one past it", () => {
    const cards = Array.from({ length: 101 }, (_, i) => card(String(i)));
    expect(paginateCards(cards, 2)).toMatchObject({
      page: 2,
      totalPages: 3,
      start: 51,
      end: 100,
    });
    expect(paginateCards(cards, 2).cards).toHaveLength(50);
    expect(paginateCards(cards, 9)).toMatchObject({
      page: 3,
      start: 101,
      end: 101,
    });
    expect(paginateCards([], 1)).toMatchObject({
      cards: [],
      totalPages: 1,
      start: 0,
      end: 0,
    });
    expect(cards).toHaveLength(101);
  });
  // The page number comes from the address bar.
  it.each([NaN, 0, -1, 1.5, Infinity])(
    "shows the first page for the page number %s",
    (requested) => {
      const cards = Array.from({ length: 101 }, (_, i) => card(String(i)));
      expect(paginateCards(cards, requested)).toMatchObject({
        page: 1,
        start: 1,
        end: 50,
      });
    },
  );
});

it("uses municipality relevance for catalog search while preserving prefecture / number order without a query", () => {
  const data = sample();
  data.cards = [
    { ...card("15-001-A001", "新潟県"), city: "出雲崎町" },
    { ...card("22-001-A001", "静岡県"), city: "三島市" },
    { ...card("22-002-A001", "静岡県"), city: "三島市" },
  ];
  data.places[0].address = "新潟県三島郡";
  data.relations = [
    {
      cardId: "15-001-A001",
      placeId: "a",
      condition: "",
      periodRaw: "",
      alternativeRaw: "",
    },
  ];
  const catalog = createCardCatalog(data);
  expect(catalogCards(catalog, { q: "三島" }).map((c) => c.id)).toEqual([
    "22-001-A001",
    "22-002-A001",
    "15-001-A001",
  ]);
  expect(catalogCards(catalog).map((c) => c.id)).toEqual([
    "15-001-A001",
    "22-001-A001",
    "22-002-A001",
  ]);
  expect(
    catalogCards(catalog, { q: "三島", pref: "15" }).map((c) => c.id),
  ).toEqual(["15-001-A001"]);
});
