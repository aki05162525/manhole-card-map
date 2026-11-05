import { describe, expect, it } from "vitest";
import {
  matchingCards,
  parseStoredView,
  selectionPins,
} from "./explorer-state";
import type { Card, Pin } from "./types";

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
  it("rejects malformed, out of bounds and nonnumeric stored map views", () => {
    for (const value of [
      null,
      "bad",
      "null",
      "{}",
      '{"lat":90,"lng":140,"zoom":5}',
      '{"lat":35,"lng":181,"zoom":5}',
      '{"lat":35,"lng":140,"zoom":"5"}',
      '{"lat":35,"lng":140,"zoom":25}',
    ]) {
      expect(parseStoredView(value)).toBeNull();
    }
    expect(parseStoredView('{"lat":35,"lng":140,"zoom":5}')).toEqual({
      lat: 35,
      lng: 140,
      zoom: 5,
    });
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
