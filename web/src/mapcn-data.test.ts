import { describe, expect, it } from "vitest";
import { pinsGeoJSON, featureCardIds } from "./mapcn-data";
import type { Pin } from "./types";
const pin: Pin = {
  id: "p1",
  cardIds: ["a", "b"],
  kind: "place",
  pref: "東京都",
  status: "unknown",
  lat: 35,
  lng: 139,
  reference: true,
};
describe("mapcn data", () => {
  it("preserves coordinate order and card/reference metadata", () => {
    const feature = pinsGeoJSON([pin]).features[0]!;
    expect(feature.geometry.coordinates).toEqual([139, 35]);
    expect(feature.properties).toMatchObject({
      id: "p1",
      kind: "place",
      pref: "東京都",
      status: "unknown",
      reference: true,
    });
    expect(featureCardIds(feature)).toEqual(["a", "b"]);
  });
  it("reads serialized IDs returned by MapLibre and ignores malformed properties", () => {
    expect(
      featureCardIds({ properties: { cardIds: '["a","a","b"]' } }),
    ).toEqual(["a", "b"]);
    expect(featureCardIds({ properties: { cardIds: "invalid" } })).toEqual([]);
    expect(featureCardIds({ properties: { cardIds: '["a",3]' } })).toEqual([
      "a",
    ]);
  });
});
