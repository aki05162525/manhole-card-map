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
          addressStatus: "valid",
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
        reference: false,
      },
      {
        id: "c",
        pref: "北海道",
        kind: "place",
        cardIds: ["01-406-A001"],
        status: "active",
        lat: 35,
        lng: 139,
        reference: false,
      },
    ],
  };
}

describe("card catalog", () => {
  it("indexes relations, deduplicates facilities, classifies unavailable pins and counts other separately", () => {
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
    expect(catalog.relationsByCard.get("01-100-C001")).toHaveLength(3);
    expect(catalog.entriesById.get("01-202-A001")?.pinReasons).toEqual([
      "relation-review",
    ]);
    expect(catalog.entriesById.get("01-231-B001")?.pinReasons).toEqual([
      "no-facility",
    ]);
    expect(catalog.entriesById.get("01-406-A001")?.pinReasons).toEqual([
      "location-unconfirmed",
    ]);
    expect(catalog.prefectures.find((p) => p.code === "01")).toMatchObject({
      total: 4,
      withPin: 1,
      withoutPin: 3,
    });
    expect(catalog.areas.find((a) => a.id === "hokkaido")?.total).toBe(4);
    expect(catalog.other).toMatchObject({
      code: "other",
      name: "その他（県の登録なし）",
      total: 1,
      withPin: 1,
    });
    expect(
      catalogCards(catalog, { pref: "other", q: "戸田市" }).map((c) => c.id),
    ).toEqual(["00-101-A001"]);
    expect(catalogCards(catalog, { pref: "13", q: "戸田市" })).toEqual([]);
  });
  it("handles no pins, unregistered relations, mixed reasons, and empty summaries", () => {
    const data = sample();
    data.pins = [];
    data.relations.push({
      cardId: "01-202-A001",
      placeId: "b",
      condition: "",
      periodRaw: "",
      alternativeRaw: "",
    });
    const catalog = createCardCatalog(data);
    expect(catalog.entriesById.get("01-202-A001")?.pinReasons).toEqual([
      "relation-review",
      "location-unconfirmed",
    ]);
    expect(catalog.entriesById.get("01-231-B001")?.facilitySummary).toBe(
      "配布場所の登録なし",
    );
    expect(catalog.withPin).toBe(0);
    expect(catalog.withoutPin).toBe(data.cards.length);
  });
  it("paginates by 50 without mutating cards and explains out of range pages", () => {
    const cards = Array.from({ length: 101 }, (_, i) => card(String(i)));
    expect(paginateCards(cards, 2)).toMatchObject({
      page: 2,
      totalPages: 3,
      start: 51,
      end: 100,
      outOfRange: false,
    });
    expect(paginateCards(cards, 2).cards).toHaveLength(50);
    expect(paginateCards(cards, 9)).toMatchObject({
      page: 3,
      requestedPage: 9,
      outOfRange: true,
      start: 101,
      end: 101,
    });
    expect(paginateCards([], 1)).toMatchObject({
      cards: [],
      totalPages: 1,
      start: 0,
      end: 0,
      outOfRange: false,
    });
    expect(paginateCards(cards, NaN).outOfRange).toBe(true);
    expect(cards).toHaveLength(101);
  });
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
