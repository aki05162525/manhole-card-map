import { describe, expect, it } from "vitest";
import { clusterCardIds, pinsGeoJSON, featureCardIds } from "./mapcn-data";
import type { Pin } from "./types";
const pin: Pin = {
  id: "p1",
  cardIds: ["a", "b"],
  kind: "place",
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
  it("paginates clusters without truncating cards and deduplicates shared facilities", async () => {
    const calls: number[] = [];
    const leaves = Array.from({ length: 251 }, (_, i) => ({
      properties: { cardIds: JSON.stringify([`card-${i}`, "shared"]) },
    }));
    const ids = await clusterCardIds(
      {
        getClusterLeaves: async (_id, limit, offset) => {
          calls.push(offset);
          return leaves.slice(offset, offset + limit);
        },
      },
      42,
      251,
    );
    expect(calls).toEqual([0, 100, 200]);
    expect(ids).toHaveLength(252);
    expect(ids).toContain("card-250");
  });
  it("stops if the source disappears or returns no more leaves", async () => {
    expect(
      await clusterCardIds({ getClusterLeaves: async () => [] }, 1, 10),
    ).toEqual([]);
  });
});
