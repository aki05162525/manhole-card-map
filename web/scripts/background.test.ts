import { expect, it } from "vitest";
// @ts-expect-error build script is JavaScript
import { simplify } from "./background-lib.mjs";

it("preserves shared borders, tiny islands and retained original coordinates", async () => {
  const ring = [
    [130, 30],
    [131, 30],
    [131.00001, 30.5],
    [131, 31],
    [130, 31],
    [130, 30],
  ];
  const neighbor = [
    [131, 30],
    [132, 30],
    [132, 31],
    [131, 31],
    [131.00001, 30.5],
    [131, 30],
  ];
  const island = [
    [130, 29],
    [130.00001, 29],
    [130.00001, 29.00001],
    [130, 29.00001],
    [130, 29],
  ];
  const input = {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: { N03_001: "A" },
        geometry: { type: "MultiPolygon", coordinates: [[ring], [island]] },
      },
      {
        type: "Feature",
        properties: { N03_001: "B" },
        geometry: { type: "Polygon", coordinates: [neighbor] },
      },
    ],
  };
  const output = await simplify(input, [[130, 29]]);
  expect(output.features).toHaveLength(3);
  const originals = new Set(
    [...ring, ...neighbor, ...island].map((p) => JSON.stringify(p)),
  );
  for (const f of output.features)
    for (const r of f.geometry.coordinates)
      for (const p of r) expect(originals.has(JSON.stringify(p))).toBe(true);
  const mainland = output.features.filter((f: any) =>
    f.geometry.coordinates[0].some((p: number[]) => p[1] === 31),
  );
  const border = (f: any) =>
    f.geometry.coordinates[0]
      .filter((p: number[]) => p[0] >= 131 && p[0] < 131.1)
      .map((p: number[]) => JSON.stringify(p));
  expect(new Set(border(mainland[0]))).toEqual(new Set(border(mainland[1])));
});

it("omits only small islands away from the protected card coordinates", async () => {
  const input = {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: { N03_001: "A" },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [130, 29],
              [130.00001, 29],
              [130.00001, 29.00001],
              [130, 29],
            ],
          ],
        },
      },
      {
        type: "Feature",
        properties: { N03_001: "A" },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [132, 29],
              [132.00001, 29],
              [132.00001, 29.00001],
              [132, 29],
            ],
          ],
        },
      },
    ],
  };
  const output = await simplify(input, [[130, 29]]);
  expect(output.features).toHaveLength(1);
});
