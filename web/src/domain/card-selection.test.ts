import { describe, expect, it } from "vitest";
import {
  cardsForIds,
  detailCard,
  matchingCards,
  searchResultExcerpt,
  visiblePins,
  selectionPins,
} from "./card-selection";
import { testCard, testPin, testPlace, testRelation } from "./test-data";

const cards = [
  testCard({ id: "TOKYO-1", pref: "東京都", city: "千代田区" }),
  testCard({ id: "OSAKA-2", pref: "大阪府", city: "大阪市" }),
];

describe("explorer state", () => {
  it("searches municipality, prefecture and ID with normalized whitespace and case", () => {
    expect(matchingCards(cards, "  tokyo-1　")).toEqual([cards[0]]);
    expect(matchingCards(cards, "大阪府 大阪市")).toEqual([cards[1]]);
    expect(matchingCards(cards, "大阪市 TOKYO")).toEqual([]);
    expect(matchingCards(cards, "")).toEqual(cards);
  });
  it("highlights all matching facilities and lids, and clears on close", () => {
    const pins = [
      testPin({ id: "shared", cardIds: ["TOKYO-1", "OSAKA-2"] }),
      testPin({ id: "lid", kind: "lid", cardIds: ["TOKYO-1"] }),
      testPin({ id: "other", cardIds: ["OTHER"] }),
    ];
    expect(selectionPins(pins, ["TOKYO-1"])).toEqual(pins.slice(0, 2));
    expect(selectionPins(pins, [])).toEqual([]);
  });
});

describe("distribution-first map", () => {
  const places = [
    testPlace({ id: "place", coordinate: { status: "confirmed" } }),
    testPlace({ id: "candidate", coordinate: { status: "candidate" } }),
  ];
  const pins = [
    testPin({ id: "place", kind: "place", cardIds: ["a", "b"] }),
    testPin({ id: "candidate", kind: "place", cardIds: ["c"] }),
    testPin({ id: "lid:a", kind: "lid", cardIds: ["a"] }),
    testPin({ id: "lid:b", kind: "lid", cardIds: ["b"] }),
  ];
  const data = { places, pins };
  it("defaults to confirmed facilities, keeping every card at a shared facility", () => {
    expect(visiblePins(data, false)).toEqual([pins[0]]);
    expect(visiblePins(data, false)[0]?.cardIds).toEqual(["a", "b"]);
  });
  it("reveals only the selected lid or explicitly toggles all lids", () => {
    expect(visiblePins(data, false, "a")).toEqual([pins[0], pins[2]]);
    expect(visiblePins(data, true)).toEqual([pins[0], pins[2], pins[3]]);
    expect(visiblePins(data, false)).toEqual([pins[0]]);
  });
  it("never substitutes a lid when no facility has been confirmed", () => {
    expect(visiblePins({ ...data, places: [] }, false)).toEqual([]);
    expect(visiblePins(null, false)).toEqual([]);
  });
  it("searches facility names and addresses without dropping unlocated cards", () => {
    const searchable = {
      places: [
        testPlace({ id: "station", name: "観光案内所", address: "駅前1" }),
      ],
      relations: [testRelation({ placeId: "station", cardId: "TOKYO-1" })],
    };
    expect(matchingCards(cards, "観光案内所", searchable)).toEqual([cards[0]]);
    expect(matchingCards(cards, "駅前1", searchable)).toEqual([cards[0]]);
    expect(matchingCards(cards, "大阪府", searchable)).toEqual([cards[1]]);
  });
});

it("keeps every clustered/shared card selectable, deduplicates and ignores unknown ids", () => {
  const cards = Array.from({ length: 10000 }, (_, i) =>
    testCard({ id: String(i) }),
  );
  const result = cardsForIds(new Map(cards.map((c) => [c.id, c])), [
    ...cards.map((c) => c.id),
    "0",
    "missing",
  ]);
  expect(result).toHaveLength(10000);
  expect(result[9999]).toBe(cards[9999]);
  expect(cardsForIds(new Map(), ["missing"])).toEqual([]);
});

it("renders no card details until a dense/shared group chooses one, and back restores the list", () => {
  const group = [testCard({ id: "a" }), testCard({ id: "b" })];
  expect(detailCard(group)).toBeUndefined();
  expect(detailCard(group, "b")).toBe(group[1]);
  expect(detailCard(group, "missing")).toBeUndefined();
  expect(detailCard(group)).toBeUndefined();
  expect(detailCard([group[0]])).toBe(group[0]);
  expect(detailCard([])).toBeUndefined();
});

it("reuses the data search index across queries, preserves input order, and replaces it with new data", () => {
  let reads = 0;
  const searchable = {
    get places() {
      reads++;
      return [testPlace({ id: "p", name: "観光案内所", address: "駅前1" })];
    },
    relations: [testRelation({ cardId: cards[0].id, placeId: "p" })],
  };
  expect(matchingCards([...cards].reverse(), "", searchable)).toEqual(
    [...cards].reverse(),
  );
  const indexedReads = reads;
  expect(matchingCards(cards, "観光 駅前", searchable)).toEqual([cards[0]]);
  expect(reads).toBe(indexedReads);
  const replacement = {
    ...searchable,
    places: [testPlace({ id: "p", name: "新施設", address: "移転先" })],
  };
  expect(matchingCards(cards, "観光", replacement)).toEqual([]);
  expect(matchingCards(cards, "新施設", replacement)).toEqual([cards[0]]);
  expect(
    matchingCards([cards[1], cards[0], cards[0]], "tokyo", searchable),
  ).toEqual([cards[0], cards[0]]);
});

it("ranks exact, prefix, substring municipality matches before destination matches, stably", () => {
  const ranked = [
    testCard({ id: "15-001", pref: "新潟県", city: "出雲崎町" }),
    testCard({ id: "22-002", pref: "静岡県", city: "三島市" }),
    testCard({ id: "22-003", pref: "静岡県", city: "南三島市" }),
    testCard({ id: "22-004", pref: "静岡県", city: "三島" }),
    testCard({ id: "22-005", pref: "静岡県", city: "三島市" }),
  ];
  const data = {
    places: [testPlace({ id: "p", name: "案内所", address: "三島郡" })],
    relations: [testRelation({ cardId: "15-001", placeId: "p" })],
  };
  expect(matchingCards(ranked, "三島", data).map((c) => c.id)).toEqual([
    "22-004",
    "22-002",
    "22-005",
    "22-003",
    "15-001",
  ]);
  expect(matchingCards(ranked, "", data)).toEqual(ranked);
});

it("finds hidden destination matches with twelve characters of context, but keeps visible matches", () => {
  const address =
    "あいうえおかきくけこさしすせそ三島郡出雲崎町たちつてとなにぬねのはひふへほ";
  expect(
    searchResultExcerpt(
      ["出雲崎町", "新潟県", "15-001", "案内所"],
      [address],
      "三島",
    ),
  ).toBe("…えおかきくけこさしすせそ三島郡出雲崎町たちつてとなに…");
  expect(searchResultExcerpt(["三島市"], [address], "三島")).toBeNull();
  expect(
    searchResultExcerpt(
      ["出雲崎町"],
      ["本館", "Second tourist center"],
      "TOURIST",
    ),
  ).toBe("Second tourist center");
  expect(searchResultExcerpt([], ["一致なし"], "三島")).toBeNull();
  expect(searchResultExcerpt([], [address], "  ")).toBeNull();
  expect(searchResultExcerpt(["新潟県"], [address], "新潟 三島")).toBeNull();
});
