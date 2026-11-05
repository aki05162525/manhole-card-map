import { describe, expect, it } from "vitest";
import { fixtureData } from "./fixtures";

describe("explicit synthetic browser fixtures", () => {
  it("identifies every card as synthetic and preserves relational integrity", () => {
    expect(fixtureData.fixture).toBe(true);
    expect(fixtureData.cards.length).toBeGreaterThan(3);
    const cards = new Set(fixtureData.cards.map((c) => c.id));
    const places = new Set(fixtureData.places.map((p) => p.id));
    expect(cards.size).toBe(fixtureData.cards.length);
    for (const card of fixtureData.cards) expect(card.city).toContain("テスト");
    for (const relation of fixtureData.relations) {
      expect(cards.has(relation.cardId)).toBe(true);
      expect(places.has(relation.placeId)).toBe(true);
    }
    for (const pin of fixtureData.pins)
      for (const id of pin.cardIds) expect(cards.has(id)).toBe(true);
  });
  it("exercises shared facilities, alternatives, dense pins and cards without pins", () => {
    expect(fixtureData.pins.some((p) => p.cardIds.length > 1)).toBe(true);
    expect(
      fixtureData.cards.some(
        (c) => !fixtureData.pins.some((p) => p.cardIds.includes(c.id)),
      ),
    ).toBe(true);
    expect(
      fixtureData.cards.some(
        (c) =>
          fixtureData.relations.filter((r) => r.cardId === c.id).length > 1,
      ),
    ).toBe(true);
    expect(
      fixtureData.places.some((p) => p.coordinate.status === "candidate"),
    ).toBe(true);
  });
});
