import { expect, it } from "vitest";
import { nationalCameraPadding } from "./area-layout";
import { clampToJapan, japanMinZoom } from "./japan-limits";

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
  const [lng, lat] = clampToJapan(-0.13, 51.5); // London
  expect(lng).toBeGreaterThanOrEqual(122);
  expect(lat).toBeLessThanOrEqual(46.5);
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
