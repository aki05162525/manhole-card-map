import { describe, expect, it, vi } from "vitest";
import {
  emphasizePrefectureBorders,
  pinsGeoJSON,
  featureCardIds,
} from "./mapcn-data";
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

it("prefecture borders update only when the emphasis changes", () => {
  const map = {
    getLayer: () => ({ id: "boundary_state" }),
    setPaintProperty: vi.fn(),
    setFilter: vi.fn(),
  };
  const update = emphasizePrefectureBorders(map);
  const empty = { area: null, pref: null };
  update(5.59, empty);
  expect(map.setPaintProperty).toHaveBeenCalledWith(
    "boundary_state",
    "line-color",
    "#ead5d7",
  );
  expect(map.setFilter).toHaveBeenCalledWith("boundary_state", [
    "==",
    ["get", "kind_detail"],
    4,
  ]);
  expect(map.setPaintProperty).toHaveBeenCalledWith(
    "boundary_state",
    "line-color-transition",
    { duration: 0, delay: 0 },
  );
  map.setPaintProperty.mockClear();
  update(5.5, empty);
  expect(map.setPaintProperty).not.toHaveBeenCalled();
  update(5.6, empty);
  expect(map.setPaintProperty).toHaveBeenCalledWith(
    "boundary_state",
    "line-color",
    "#7d6a78",
  );
  map.setPaintProperty.mockClear();
  update(7, empty);
  update(5.5, { area: "kanto", pref: null });
  update(5.4, { area: "kanto", pref: "東京都" });
  expect(map.setPaintProperty).not.toHaveBeenCalled();
  update(5.4, empty);
  expect(map.setPaintProperty).toHaveBeenCalledWith(
    "boundary_state",
    "line-color",
    "#ead5d7",
  );
  expect(map.setFilter).toHaveBeenCalledTimes(1);
});

it("does nothing when the style has no prefecture border layer", () => {
  const map = {
    getLayer: () => undefined,
    setPaintProperty: vi.fn(),
    setFilter: vi.fn(),
  };
  const update = emphasizePrefectureBorders(map);
  update(5.59, { area: null, pref: null });
  update(5.6, { area: "kanto", pref: "東京都" });
  expect(map.setPaintProperty).not.toHaveBeenCalled();
  expect(map.setFilter).not.toHaveBeenCalled();
});
