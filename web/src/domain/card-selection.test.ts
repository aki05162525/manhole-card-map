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
    expect(visiblePins(data, false)).toEqual([
      { ...pins[0], cardIds: ["a", "b"] },
    ]);
  });
  it("reveals only the selected lid or explicitly toggles all lids", () => {
    expect(visiblePins(data, false, "a")).toEqual([pins[0], pins[2]]);
    expect(visiblePins(data, true)).toEqual([pins[0], pins[2], pins[3]]);
  });
  // A review of the position overrides the coordinate's own status.
  it("hides a facility whose reviewed position was withdrawn, and shows one reconfirmed", () => {
    const reviewed = (status: "confirmed" | "withdrawn") =>
      testPlace({
        id: status,
        coordinate: { status: "confirmed" },
        locationReview: { status, reason: "" },
      });
    const shown = testPin({ id: "confirmed" });
    expect(
      visiblePins(
        {
          places: [reviewed("withdrawn"), reviewed("confirmed")],
          pins: [testPin({ id: "withdrawn" }), shown],
        },
        false,
      ),
    ).toEqual([shown]);
  });
  it("searches facility names and addresses without dropping unlocated cards", () => {
    const searchable = {
      places: [
        testPlace({ id: "station", name: "観光案内所", address: "駅前1" }),
        testPlace({ id: "hall", name: "市役所", address: "中央2" }),
      ],
      relations: [
        testRelation({ placeId: "station", cardId: "TOKYO-1" }),
        testRelation({ placeId: "hall", cardId: "TOKYO-1" }),
      ],
    };
    expect(matchingCards(cards, "観光案内所", searchable)).toEqual([cards[0]]);
    expect(matchingCards(cards, "駅前1", searchable)).toEqual([cards[0]]);
    expect(matchingCards(cards, "市役所 駅前", searchable)).toEqual([cards[0]]);
    // One place's text does not run into the next one's.
    expect(matchingCards(cards, "駅前1市役所", searchable)).toEqual([]);
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
  expect(result.map((card) => card.id)).toEqual(cards.map((card) => card.id));
  expect(cardsForIds(new Map(), ["missing"])).toEqual([]);
});

it("shows the selected card in a group, or the only card when no ID is selected", () => {
  const group = [testCard({ id: "a" }), testCard({ id: "b" })];
  expect(detailCard(group)).toBeUndefined();
  expect(detailCard(group, "b")).toEqual(group[1]);
  expect(detailCard(group, "missing")).toBeUndefined();
  expect(detailCard([group[0]])).toEqual(group[0]);
  expect(detailCard([])).toBeUndefined();
});

it("searches a loaded facility's text across queries and reads its replacement after a move", () => {
  let nameReads = 0;
  const searchable = {
    places: [
      {
        ...testPlace({ id: "p", address: "駅前1" }),
        get name() {
          nameReads++;
          return "観光案内所";
        },
      },
    ],
    relations: [testRelation({ cardId: cards[0].id, placeId: "p" })],
  };
  expect(matchingCards(cards, "観光", searchable)).toEqual([cards[0]]);
  const firstQueryReads = nameReads;
  expect(matchingCards(cards, "駅前", searchable)).toEqual([cards[0]]);
  expect(nameReads).toBe(firstQueryReads);
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

describe("municipality ranking", () => {
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
  const ids = (query: string) =>
    matchingCards(ranked, query, data).map((c) => c.id);
  it("ranks exact, prefix, substring municipality matches before destination matches, stably", () => {
    const order = ["22-004", "22-002", "22-005", "22-003", "15-001"];
    expect(ids("三島")).toEqual(order);
    expect(ids(" 三島　")).toEqual(order);
  });
  // Words are matched one by one: together they name no municipality.
  it("keeps the given order for words that only match apart", () => {
    expect(ids("三 島")).toEqual(ranked.map((c) => c.id));
  });
  it("keeps the given order without a query, a card with no municipality included", () => {
    const unnamed = testCard({ id: "99-001" });
    expect(matchingCards([...ranked, unnamed], "", data)).toEqual([
      ...ranked,
      unnamed,
    ]);
  });
  it("ranks a municipality in Latin letters whatever the case", () => {
    const latin = [
      testCard({ id: "1", city: "New Niseko" }),
      testCard({ id: "2", city: "Niseko" }),
    ];
    expect(matchingCards(latin, "NISEKO").map((c) => c.id)).toEqual(["2", "1"]);
  });
});

describe("searchResultExcerpt", () => {
  const address =
    "あいうえおかきくけこさしすせそ三島郡出雲崎町たちつてとなにぬねのはひふへほ";
  const around = "…えおかきくけこさしすせそ三島郡出雲崎町たちつてとなに…";
  it("finds hidden destination matches with twelve characters of context", () => {
    expect(
      searchResultExcerpt(
        ["出雲崎町", "新潟県", "15-001", "案内所"],
        [address],
        "三島",
      ),
    ).toBe(around);
    expect(
      searchResultExcerpt(
        ["出雲崎町"],
        ["本館", "Second tourist center"],
        "TOURIST",
      ),
    ).toBe("Second tourist center");
    expect(searchResultExcerpt([], ["一致なし"], "三島")).toBeNull();
    expect(searchResultExcerpt([], [address], "  ")).toBeNull();
  });
  it("starts from the first of several words found, in whichever order they were typed", () => {
    expect(searchResultExcerpt([], [address], "三島 たちつ")).toBe(around);
    expect(searchResultExcerpt([], [address], "たちつ 三島")).toBe(around);
  });
  it("explains nothing when a visible text already matches a word", () => {
    expect(
      searchResultExcerpt(["静岡県", "三島市"], [address], "三島"),
    ).toBeNull();
    expect(searchResultExcerpt(["新潟県"], [address], "新潟 三島")).toBeNull();
    expect(
      searchResultExcerpt(["Tourist office"], [address], "TOURIST 三島"),
    ).toBeNull();
  });
});
