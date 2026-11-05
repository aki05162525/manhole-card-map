import { expect, it } from "vitest";
import type { FeatureCollection, Polygon } from "geojson";
import { groupBackgroundShapes } from "./background-shapes";

it("draws one layer per prefecture while preserving every island, hole and coordinate", () => {
  const ring = [
    [139, 35],
    [140, 35],
    [140, 36],
    [139, 35],
  ];
  const hole = [
    [139.2, 35.2],
    [139.4, 35.2],
    [139.4, 35.4],
    [139.2, 35.2],
  ];
  const input: FeatureCollection<Polygon> = {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: { N03_001: "A" },
        geometry: { type: "Polygon", coordinates: [ring, hole] },
      },
      {
        type: "Feature",
        properties: { N03_001: "A" },
        geometry: { type: "Polygon", coordinates: [ring] },
      },
      {
        type: "Feature",
        properties: { N03_001: "B" },
        geometry: { type: "Polygon", coordinates: [ring] },
      },
    ],
  };
  const before = JSON.stringify(input);
  const result = groupBackgroundShapes(input);
  expect(result.features).toHaveLength(2);
  expect(result.features[0]!.geometry.coordinates).toEqual([
    [ring, hole],
    [ring],
  ]);
  expect(result.features[1]!.geometry.coordinates).toEqual([[ring]]);
  expect(JSON.stringify(input)).toBe(before);
});
it("keeps existing multipart shapes and rejects non-area geometry", () => {
  const polygon = [
    [
      [139, 35],
      [140, 35],
      [140, 36],
      [139, 35],
    ],
  ];
  expect(
    groupBackgroundShapes({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: { N03_001: "A" },
          geometry: { type: "MultiPolygon", coordinates: [polygon, polygon] },
        },
      ],
    }).features[0]!.geometry.coordinates,
  ).toEqual([polygon, polygon]);
  expect(() =>
    groupBackgroundShapes({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {},
          geometry: { type: "Point", coordinates: [0, 0] },
        },
      ],
    }),
  ).toThrow();
});
