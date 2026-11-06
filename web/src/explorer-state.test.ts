import { describe, expect, it } from "vitest";
import {
  panelOpenByDefault,
  focusFromHistory,
  prefectureCards,
  matchingCards,
  visiblePins,
  selectionPins,
} from "./explorer-state";
import { colors, type Card, type Pin, type Data } from "./types";

const cards = [
  { id: "TOKYO-1", pref: "東京都", city: "千代田区" },
  { id: "OSAKA-2", pref: "大阪府", city: "大阪市" },
] as Card[];

describe("explorer state", () => {
  it("searches municipality, prefecture and ID with normalized whitespace and case", () => {
    expect(matchingCards(cards, "  tokyo-1　")).toEqual([cards[0]]);
    expect(matchingCards(cards, "大阪府 大阪市")).toEqual([cards[1]]);
    expect(matchingCards(cards, "大阪市 TOKYO")).toEqual([]);
    expect(matchingCards(cards, "")).toEqual(cards);
  });
  it("highlights all matching facilities and lids, and clears on close", () => {
    const pins = [
      { id: "shared", cardIds: ["TOKYO-1", "OSAKA-2"] },
      { id: "lid", cardIds: ["TOKYO-1"] },
      { id: "other", cardIds: ["OTHER"] },
    ] as Pin[];
    expect(selectionPins(pins, ["TOKYO-1"])).toEqual(pins.slice(0, 2));
    expect(selectionPins(pins, [])).toEqual([]);
  });
});

describe("distribution-first map", () => {
  const places = [
    { id: "place", coordinate: { status: "confirmed" } },
    { id: "candidate", coordinate: { status: "candidate" } },
  ] as Data["places"];
  const pins = [
    { id: "place", kind: "place", cardIds: ["a", "b"], reference: false },
    { id: "candidate", kind: "place", cardIds: ["c"], reference: false },
    { id: "reference", kind: "place", cardIds: ["d"], reference: true },
    { id: "lid:a", kind: "lid", cardIds: ["a"], reference: false },
    { id: "lid:b", kind: "lid", cardIds: ["b"], reference: false },
  ] as Pin[];
  const data = { places, pins } as Data;
  it("defaults to confirmed facilities, keeping every card at a shared facility", () => {
    expect(visiblePins(data, false)).toEqual([pins[0]]);
    expect(visiblePins(data, false)[0]?.cardIds).toEqual(["a", "b"]);
  });
  it("reveals only the selected lid or explicitly toggles all lids", () => {
    expect(visiblePins(data, false, "a")).toEqual([pins[0], pins[3]]);
    expect(visiblePins(data, true)).toEqual([pins[0], pins[3], pins[4]]);
    expect(visiblePins(data, false)).toEqual([pins[0]]);
  });
  it("never substitutes a lid when no facility has been confirmed", () => {
    expect(visiblePins({ ...data, places: [] }, false)).toEqual([]);
    expect(visiblePins(null, false)).toEqual([]);
  });
  it("searches facility names and addresses without dropping unlocated cards", () => {
    const searchable = {
      cards,
      places: [{ id: "station", name: "観光案内所", address: "駅前1" }],
      relations: [{ placeId: "station", cardId: "TOKYO-1" }],
    } as Data;
    expect(matchingCards(cards, "観光案内所", searchable)).toEqual([cards[0]]);
    expect(matchingCards(cards, "駅前1", searchable)).toEqual([cards[0]]);
    expect(matchingCards(cards, "大阪府", searchable)).toEqual([cards[1]]);
  });
});

it("counts unique cards across facilities, including zero and unspecified prefectures", () => {
  const data = {
    cards: [...cards, { id: "empty", pref: "" }],
    places: ["a", "b"].map((id) => ({
      id,
      coordinate: { status: "confirmed" },
    })),
    pins: ["a", "b"].map((id) => ({ id, kind: "place", cardIds: ["TOKYO-1"] })),
  } as Data;
  expect(prefectureCards(data, "東京都")).toMatchObject({
    total: 1,
    visible: 1,
    unknown: 0,
  });
  expect(prefectureCards(data, "大阪府")).toMatchObject({
    total: 1,
    visible: 0,
    unknown: 1,
  });
  expect(prefectureCards(data, "北海道")).toEqual({
    cards: [],
    total: 0,
    visible: 0,
    unknown: 0,
  });
  expect(prefectureCards(data, "")).toMatchObject({
    total: 1,
    visible: 0,
    unknown: 1,
  });
});

it("restores history focus and returns to nationwide for an entry without state", () => {
  expect(focusFromHistory(null)).toEqual({ area: null, pref: null });
  expect(focusFromHistory({})).toEqual({ area: null, pref: null });
  expect(
    focusFromHistory({ mapFocus: { area: "kanto", pref: "東京都" } }),
  ).toEqual({ area: "kanto", pref: "東京都" });
});

it("search panel starts closed only where it would cover the map", () => {
  expect(panelOpenByDefault(390)).toBe(false);
  expect(panelOpenByDefault(1000)).toBe(false);
  expect(panelOpenByDefault(1001)).toBe(true);
});

it("shows places that do not hand out cards in one gray, keeping unknown apart", () => {
  expect(colors.suspended).toBe(colors.ended);
  expect(colors.unknown).not.toBe(colors.ended);
});
