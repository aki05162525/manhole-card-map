import { expect, it } from "vitest";
import { JAPAN_OUTLINE, japanMaskGeoJSON } from "./japan-mask";

type P = [number, number];
const inside = ([x, y]: P) => {
  let hit = false;
  for (
    let i = 0, j = JAPAN_OUTLINE.length - 1;
    i < JAPAN_OUTLINE.length;
    j = i++
  ) {
    const [xi, yi] = JAPAN_OUTLINE[i]!,
      [xj, yj] = JAPAN_OUTLINE[j]!;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)
      hit = !hit;
  }
  return hit;
};
/** Kilometres from a place to the outline, in a local flat projection. */
const clearance = ([x, y]: P) => {
  const kx = 111.32 * Math.cos((y * Math.PI) / 180),
    ky = 110.57;
  let best = Infinity;
  for (let i = 0; i < JAPAN_OUTLINE.length; i++) {
    const [ax, ay] = JAPAN_OUTLINE[i]!,
      [bx, by] = JAPAN_OUTLINE[(i + 1) % JAPAN_OUTLINE.length]!;
    const ux = (bx - ax) * kx,
      uy = (by - ay) * ky,
      px = (x - ax) * kx,
      py = (y - ay) * ky;
    const t = Math.max(
      0,
      Math.min(1, (px * ux + py * uy) / (ux * ux + uy * uy)),
    );
    best = Math.min(best, Math.hypot(px - t * ux, py - t * uy));
  }
  return best;
};
// The places nearest a neighbour, and the farthest islands, on each side.
const japan: Record<string, P> = {
  与那国島: [122.93, 24.45],
  波照間島: [123.79, 24.06],
  魚釣島: [123.47, 25.74],
  大正島: [124.56, 25.92],
  北大東島: [131.3, 25.95],
  沖大東島: [131.23, 24.47],
  沖ノ鳥島: [136.08, 20.42],
  南硫黄島: [141.46, 24.23],
  父島: [142.19, 27.09],
  鳥島: [140.3, 30.48],
  南鳥島: [153.98, 24.29],
  男女群島: [128.35, 31.98],
  福江島: [128.6, 32.62],
  対馬南端: [129.2, 34.1],
  対馬北端: [129.45, 34.7],
  沖ノ島: [130.1, 34.24],
  竹島: [131.87, 37.24],
  隠岐: [133.2, 36.2],
  佐渡: [138.4, 38.0],
  奥尻島: [139.45, 42.15],
  礼文島: [140.95, 45.45],
  宗谷岬: [141.94, 45.52],
  知床岬: [145.33, 44.35],
  納沙布岬: [145.82, 43.38],
  色丹島: [146.75, 43.8],
  択捉島北東端: [148.85, 45.5],
};
const abroad: Record<string, P> = {
  釜山: [129.08, 35.05],
  巨済島: [128.6, 34.75],
  所每物島: [128.55, 34.62],
  巨文島: [127.31, 34.03],
  済州島: [126.55, 33.5],
  蔚山: [129.43, 35.5],
  浦項: [129.57, 36.08],
  鬱陵島: [130.87, 37.5],
  ウラジオストク: [131.9, 43.1],
  モネロン島: [141.23, 46.25],
  クリリオン岬: [142.08, 45.9],
  アニワ岬: [143.42, 46.02],
  得撫島南西端: [149.43, 45.78],
  基隆: [121.74, 25.13],
  彭佳嶼: [122.07, 25.63],
  蘇澳: [121.86, 24.59],
  亀山島: [121.95, 24.84],
  嵊泗列島: [122.8, 30.75],
  ファラリョン・デ・パハロス: [144.9, 20.54],
};

it("leaves every Japanese island open and covers the neighbours' nearest land", () => {
  for (const [name, place] of Object.entries(japan))
    expect([name, inside(place)]).toEqual([name, true]);
  for (const [name, place] of Object.entries(abroad))
    expect([name, inside(place)]).toEqual([name, false]);
});

it("keeps the edge in open water, at least 15 km from land on either side", () => {
  for (const [name, place] of Object.entries({ ...japan, ...abroad }))
    expect([name, clearance(place) >= 15]).toEqual([name, true]);
});

it("cuts Japan out of the world as a hole, wound against the outer ring", () => {
  const [outer, hole] = japanMaskGeoJSON().geometry.coordinates;
  const area = (ring: number[][]) =>
    ring.reduce((sum, [x, y], i) => {
      const [nx, ny] = ring[(i + 1) % ring.length]!;
      return sum + x! * ny! - nx! * y!;
    }, 0);
  expect(Math.sign(area(outer!))).toBe(-Math.sign(area(hole!)));
});

it("paints the mask as sea above the basemap, below every app layer, in both themes", async () => {
  const { installMapResources, repaintMapResources } =
    await import("./map-resources");
  const { mapPalette } = await import("./map-theme");
  const layers: {
    id: string;
    type: string;
    paint?: Record<string, unknown>;
  }[] = [
    { id: "land", type: "fill" },
    { id: "watername_sea", type: "symbol" },
  ];
  const map = {
    getContainer: () => ({ getBoundingClientRect: () => ({ width: 1440 }) }),
    addSource() {},
    addLayer(layer: (typeof layers)[number]) {
      layers.push(layer);
    },
    getLayer: (id: string) => layers.find((l) => l.id === id),
    setPaintProperty(id: string, key: string, value: unknown) {
      layers.find((l) => l.id === id)!.paint![key] = value;
    },
    moveLayer(id: string) {
      const i = layers.findIndex((l) => l.id === id);
      layers.push(...layers.splice(i, 1));
    },
    hasImage: () => false,
    addImage() {},
    getZoom: () => 5,
    getStyle: () => ({}),
  };
  installMapResources(
    map as never,
    { pins: [], selectedPins: [], focus: { area: null, pref: null } } as never,
    { areas: {}, prefs: {} } as never,
    [],
    [],
  );
  const mask = layers[1]!;
  // A sea name stays whole across the mask's edge.
  expect(layers.map((l) => l.id).slice(0, 3)).toEqual([
    "land",
    "japan-mask",
    "watername_sea",
  ]);
  expect(mask.type).toBe("fill");
  expect(mask.paint!["fill-color"]).toBe(mapPalette(false).water);
  repaintMapResources(map as never, true);
  expect(mask.paint!["fill-color"]).toBe(mapPalette(true).water);
});
