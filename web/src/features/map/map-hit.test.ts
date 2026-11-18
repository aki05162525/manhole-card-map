import { expect, it } from "vitest";
import { badgeTarget, pinTarget } from "./map-hit";

const point = { type: "Point", coordinates: [139.7, 35.6] };

it("selects a rendered pin by its id, cards and position", () => {
  expect(
    pinTarget({
      geometry: point,
      properties: { id: "p1", cardIds: '["a","b"]', kind: "place" },
    }),
  ).toEqual({ id: "p1", cardIds: ["a", "b"], lngLat: [139.7, 35.6] });
});

it.each([
  ["a polygon", { type: "Polygon", coordinates: [[[139, 35]]] }],
  ["no geometry", undefined],
  ["a point without a latitude", { type: "Point", coordinates: [139] }],
  ["a point with text coordinates", { type: "Point", coordinates: ["1", "2"] }],
])("leaves out a pin whose geometry is %s", (_, geometry) => {
  expect(
    pinTarget({ geometry, properties: { id: "p1", cardIds: '["a"]' } }),
  ).toBeNull();
});

it.each([
  ["no id", { cardIds: '["a"]' }],
  ["a numeric id", { id: 3, cardIds: '["a"]' }],
  ["no cards", { id: "p1", cardIds: "[]" }],
  ["unreadable cards", { id: "p1", cardIds: "invalid" }],
  ["no properties", null],
])("leaves out a pin with %s", (_, properties) => {
  expect(pinTarget({ geometry: point, properties })).toBeNull();
});

it("reads count badges by kind and leaves out other kinds", () => {
  expect(
    badgeTarget({ geometry: point, properties: { kind: "area", id: "kanto" } }),
  ).toEqual({ kind: "area", id: "kanto", lngLat: [139.7, 35.6] });
  expect(
    badgeTarget({
      geometry: point,
      properties: { kind: "pref", id: "東京都" },
    }),
  ).toEqual({ kind: "pref", id: "東京都", lngLat: [139.7, 35.6] });
  expect(
    badgeTarget({ geometry: point, properties: { kind: "city", id: "x" } }),
  ).toBeNull();
  expect(
    badgeTarget({ geometry: point, properties: { kind: "area", id: 1 } }),
  ).toBeNull();
  expect(
    badgeTarget({
      geometry: { type: "LineString", coordinates: [[139, 35]] },
      properties: { kind: "area", id: "kanto" },
    }),
  ).toBeNull();
});
