import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { NATIONAL_BOUNDS } from "./area-layout";
import { mapPalette } from "./map-theme";
import { PIN_MIN_ZOOM } from "./map-levels";
import { stageCamera } from "./stage-camera";

const padding = { top: 72, bottom: 16, left: 8, right: 8 };
const national = { bounds: NATIONAL_BOUNDS, maxZoom: PIN_MIN_ZOOM - 0.1 };

it("fits a tall screen by its width, centred in what the padding leaves", () => {
  const camera = stageCamera(390, 844, { ...national, padding });
  const [[west, south], [east, north]] = NATIONAL_BOUNDS;
  expect(camera.x(west)).toBeCloseTo(8);
  expect(camera.x(east)).toBeCloseTo(382);
  // Mercator stretches the north: the middle latitude lies below the centre.
  expect((camera.y(south) + camera.y(north)) / 2).toBeCloseTo(
    72 + (844 - 72 - 16) / 2,
  );
  expect(camera.y(north)).toBeGreaterThan(72);
  expect(camera.y((south + north) / 2)).toBeGreaterThan(
    (camera.y(south) + camera.y(north)) / 2,
  );
  // 374px over 18.5 degrees, in MapLibre's 512px world.
  expect(camera.zoom).toBeCloseTo(Math.log2(((374 / 18.5) * 360) / 512));
});

it("fits a wide screen by its height", () => {
  const camera = stageCamera(1440, 900, { ...national, padding });
  const [[west, south], [east, north]] = NATIONAL_BOUNDS;
  expect(camera.y(north)).toBeCloseTo(72);
  expect(camera.y(south)).toBeCloseTo(884);
  expect(camera.x(west)).toBeGreaterThan(8);
  expect((camera.x(west) + camera.x(east)) / 2).toBeCloseTo(720);
});

it("comes no closer than the level's zoom limit", () => {
  const camera = stageCamera(4000, 4000, {
    bounds: [
      [139, 35],
      [140, 36],
    ],
    maxZoom: 6.9,
    padding,
  });
  expect(camera.zoom).toBeCloseTo(6.9);
  expect(camera.x(140) - camera.x(139)).toBeCloseTo((512 * 2 ** 6.9) / 360);
});

it("paints the stage with the basemap's land and sea in each scheme", () => {
  const css = readFileSync(
    new URL("../../shared/ui/tokens.css", import.meta.url),
    "utf8",
  );
  const declared = (name: string) =>
    [...css.matchAll(new RegExp(`--stage-${name}: (#[0-9a-f]{6});`, "g"))].map(
      (match) => match[1],
    );
  for (const name of ["land", "water"] as const)
    expect(declared(name)).toEqual([
      mapPalette(false)[name],
      mapPalette(true)[name],
    ]);
});

it("draws a fitted level at the view MapLibre is handed, pixel for pixel", async () => {
  const { fitView, viewCamera } = await import("./stage-camera");
  const level = {
    bounds: [
      [139.32, 35.65],
      [139.77, 35.7],
    ] as [[number, number], [number, number]],
    maxZoom: 11,
    padding,
  };
  const fitted = stageCamera(412, 915, level);
  const opened = viewCamera(412, 915, fitView(412, 915, level));
  for (const [lng, lat] of [
    [139.32, 35.65],
    [139.7536, 35.694],
    [142.19, 27.09],
  ]) {
    expect(opened.x(lng)).toBeCloseTo(fitted.x(lng), 6);
    expect(opened.y(lat)).toBeCloseTo(fitted.y(lat), 6);
  }
});

it("comes closer around a press, the place under it staying there", async () => {
  const { closerView, viewCamera } = await import("./stage-camera");
  const view = { center: [139.5, 35.7] as [number, number], zoom: 9 };
  const before = viewCamera(412, 915, view);
  const place = [before.lngAt(300), before.latAt(200)];
  const closer = closerView(412, 915, view, { x: 300, y: 200 }, 4, 15);
  const after = viewCamera(412, 915, closer);
  expect(closer.zoom).toBeCloseTo(11);
  expect(after.x(place[0])).toBeCloseTo(300, 6);
  expect(after.y(place[1])).toBeCloseTo(200, 6);
  // No closer than the limit.
  expect(closerView(412, 915, closer, { x: 0, y: 0 }, 64, 15).zoom).toBe(15);
});
