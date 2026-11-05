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

it("drops unprotected sub-km islands but retains the same island near a card", async () => {
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
              [130, 30],
              [130.005, 30],
              [130.005, 30.005],
              [130, 30.005],
              [130, 30],
            ],
          ],
        },
      },
    ],
  };
  const empty = await simplify(input, []);
  expect(empty.features ?? empty.geometries).toHaveLength(0);
  expect((await simplify(input, [[130.002, 30.002]])).features).toHaveLength(1);
});

it("rounds background coordinates to six decimals without changing source data", async () => {
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
              [130.12345678, 30.12345678],
              [131.12345678, 30.12345678],
              [131.12345678, 31.12345678],
              [130.12345678, 30.12345678],
            ],
          ],
        },
      },
    ],
  };
  const original = JSON.stringify(input);
  const result = await simplify(input);
  expect(JSON.stringify(input)).toBe(original);
  for (const feature of result.features)
    for (const ring of feature.geometry.coordinates)
      for (const value of ring.flat())
        expect(value).toBe(Number(value.toFixed(6)));
});

it("ships a bounded overview with valid rounded rings and all prefectures", async () => {
  const { readFile } = await import("node:fs/promises");
  const { brotliCompressSync } = await import("node:zlib");
  const bytes = await readFile("public/background/japan.geojson");
  const manifest = JSON.parse(
    await readFile("public/background/manifest.json", "utf8"),
  );
  const { createHash } = await import("node:crypto");
  expect(manifest.outputSHA256).toBe(
    createHash("sha256").update(bytes).digest("hex"),
  );
  expect(manifest.maxZoom).toBe(8);
  expect(manifest.outputPrecisionDegrees).toBe(0.000001);
  expect(brotliCompressSync(bytes).length).toBeLessThan(300000);
  const data = JSON.parse(bytes.toString());
  const names = new Set<string>();
  for (const feature of data.features) {
    names.add(feature.properties.N03_001);
    expect(feature.geometry.type).toBe("Polygon");
    for (const ring of feature.geometry.coordinates) {
      expect(ring.length).toBeGreaterThanOrEqual(4);
      expect(ring[0]).toEqual(ring.at(-1));
      expect(
        new Set(ring.map((p: number[]) => JSON.stringify(p))).size,
      ).toBeGreaterThanOrEqual(3);
      for (const value of ring.flat())
        expect(value).toBe(Number(value.toFixed(6)));
      const area = ring
        .slice(1)
        .reduce(
          (sum: number, p: number[], i: number) =>
            sum + ring[i][0] * p[1] - p[0] * ring[i][1],
          0,
        );
      expect(Math.abs(area)).toBeGreaterThan(0);
    }
  }
  expect(names.size).toBe(47);
});

it("retains sub-grid protected islands rather than rounding them away", async () => {
  const ring = [
    [130.000001, 30.000001],
    [130.000002, 30.000001],
    [130.000002, 30.000002],
    [130.000001, 30.000001],
  ];
  const input = {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: { N03_001: "A" },
        geometry: { type: "Polygon", coordinates: [ring] },
      },
    ],
  };
  const result = await simplify(input, [[130, 30]]);
  expect(
    new Set(
      result.features[0].geometry?.coordinates[0].map((p: number[]) =>
        JSON.stringify(p),
      ),
    ),
  ).toEqual(new Set(ring.map((p) => JSON.stringify(p))));
});
