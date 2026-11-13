import type { Feature, Polygon } from "geojson";

/**
 * A rough line through open water around Japan, mid-strait where a neighbour is
 * near (Tsushima, Soya, Etorofu and Urup, Yonaguni and Taiwan). It includes the
 * islands Japan administers or claims, as the national land data does.
 * Not a coastline: the basemap draws the coasts inside it.
 */
export const JAPAN_OUTLINE: readonly [number, number][] = [
  [140.5, 45.75],
  [142.0, 45.71],
  [143.2, 45.6],
  [145.5, 45.4],
  [147.5, 45.75],
  [148.6, 45.9],
  [149.15, 45.6],
  [149.5, 45.2],
  [155, 44],
  [155, 23],
  [146, 23],
  [138, 22],
  [137, 19.9],
  [135, 19.9],
  [131.5, 22.5],
  [124, 23.3],
  [122.5, 24.0],
  [122.45, 24.8],
  [122.6, 25.5],
  [123.0, 26.2],
  [125.5, 28.8],
  [127.7, 31.3],
  [128.0, 32.3],
  [128.3, 33.5],
  [128.75, 34.2],
  [129.25, 34.88],
  [130.0, 35.5],
  [131.4, 37.0],
  [133.5, 39.5],
  [137, 42],
  [139, 44.3],
];

const signedArea = (ring: readonly (readonly [number, number])[]) =>
  ring.reduce((sum, [x, y], i) => {
    const [nx, ny] = ring[(i + 1) % ring.length]!;
    return sum + x * ny - nx * y;
  }, 0);

/** The world with Japan cut out; painted as sea over the basemap's other land. */
export function japanMaskGeoJSON(): Feature<Polygon> {
  const outer: [number, number][] = [
    [-180, -85],
    [180, -85],
    [180, 85],
    [-180, 85],
  ];
  // MapLibre reads a ring wound like the outer one as another polygon.
  const hole =
    Math.sign(signedArea(JAPAN_OUTLINE)) === Math.sign(signedArea(outer))
      ? [...JAPAN_OUTLINE].reverse()
      : [...JAPAN_OUTLINE];
  return {
    type: "Feature",
    properties: {},
    geometry: {
      type: "Polygon",
      coordinates: [
        [...outer, outer[0]!],
        [...hole, hole[0]!],
      ],
    },
  };
}
