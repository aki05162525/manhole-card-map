import { expect, it } from "vitest";
import { LngLat, MercatorCoordinate } from "maplibre-gl";
import { NATIONAL_BOUNDS, nationalCameraPadding } from "./area-layout";
import { clampToJapan, constrainToJapan, japanMinZoom } from "./japan-limits";

it("keeps outlying islands reachable and pulls a far-away centre back to Japan", () => {
  const islands: [number, number][] = [
    [122.94, 24.45], // Yonaguni
    [136.08, 20.42], // Okinotorishima
    [142.19, 27.09], // Chichijima
    [153.98, 24.29], // Minamitorishima
    [141.94, 45.52], // Cape Soya
  ];
  for (const [lng, lat] of islands)
    expect(clampToJapan(lng, lat)).toEqual([lng, lat]);
  expect(clampToJapan(-0.13, 51.5)).toEqual([122, 46.5]); // London
  expect(clampToJapan(174.8, -41.3)).toEqual([154, 20]); // Wellington
});

it("keeps the centre over Japan and the zoom inside the map's own limits", () => {
  const constrain = constrainToJapan({
    getMinZoom: () => 3,
    getMaxZoom: () => 18,
  });
  const read = (lng: number, lat: number, zoom: number) => {
    const { center, zoom: allowed } = constrain(new LngLat(lng, lat), zoom);
    return [center.lng, center.lat, allowed];
  };
  expect(read(139.5, 35.5, 9)).toEqual([139.5, 35.5, 9]);
  // A turn of the world away is the same place.
  expect(read(139.5 - 360, 35.5, 9)).toEqual([139.5, 35.5, 9]);
  expect(read(-0.5, 51.5, 1)).toEqual([122, 46.5, 3]); // London
  expect(read(139.5, 35.5, 20)).toEqual([139.5, 35.5, 18]);
});

it("fits the national bounds exactly inside the padded viewport, and allows half a level more", () => {
  const [sw, ne] = NATIONAL_BOUNDS.map(([lng, lat]) =>
    MercatorCoordinate.fromLngLat({ lng, lat }),
  );
  for (const [width, height, padding] of [
    [412, 915, { top: 72, right: 8, bottom: 16, left: 24 }],
    [1440, 900, { top: 88, right: 24, bottom: 16, left: 40 }],
    [2560, 600, { top: 10, right: 300, bottom: 40, left: 20 }],
  ] as const) {
    const zoom = japanMinZoom(width, height, padding, 0);
    const world = 512 * 2 ** zoom;
    const across =
      (world * (ne.x - sw.x)) / (width - padding.left - padding.right);
    const down =
      (world * (sw.y - ne.y)) / (height - padding.top - padding.bottom);
    // One side fills its room and the other fits inside.
    expect(Math.max(across, down)).toBeCloseTo(1);
    expect(japanMinZoom(width, height, padding)).toBeCloseTo(zoom - 0.5);
  }
});

it("allows the national view but not a view of most of the world", () => {
  for (const [width, height] of [
    [360, 640],
    [412, 915],
    [1440, 900],
    [2560, 1440],
  ]) {
    const padding = nationalCameraPadding(64, width);
    const min = japanMinZoom(width, height, padding);
    const national = japanMinZoom(width, height, padding, 0);
    expect(national).toBeGreaterThan(min);
    const visibleLngs = (width / (512 * 2 ** min)) * 360;
    expect(visibleLngs).toBeLessThan(90);
  }
});
