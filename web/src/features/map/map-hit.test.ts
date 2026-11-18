import { expect, it } from "vitest";
import { badgeTarget, hasPin, nearestPin, pinTarget } from "./map-hit";

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

const at = (x: number, properties: Record<string, unknown>) => ({
  geometry: { type: "Point", coordinates: [x, 0] },
  properties,
});

it("picks the nearest readable pin, topmost first on ties", () => {
  const distance = ([x]: [number, number]) => Math.abs(x);
  const features = [
    at(3, { id: "far", cardIds: '["f"]' }),
    at(0, { id: "unreadable", cardIds: "[]" }),
    at(-1, { id: "top", cardIds: '["t"]' }),
    at(1, { id: "lower", cardIds: '["l"]' }),
  ];
  expect(nearestPin(features, distance)).toEqual({
    id: "top",
    cardIds: ["t"],
    lngLat: [-1, 0],
  });
  expect(nearestPin([features[1]], distance)).toBeNull();
  expect(hasPin([features[1]])).toBe(false);
  expect(hasPin(features)).toBe(true);
});

it("reads each pin's own cards when pins alternate, and a caller's edit stays its own", () => {
  const a = at(0, { id: "a", cardIds: '["a1","a2"]' });
  const b = at(0, { id: "b", cardIds: '["b1"]' });
  pinTarget(a)?.cardIds.push("edited");
  expect(pinTarget(b)?.cardIds).toEqual(["b1"]);
  expect(pinTarget(a)?.cardIds).toEqual(["a1", "a2"]);
  expect(pinTarget(a)?.cardIds).toEqual(["a1", "a2"]);
});
