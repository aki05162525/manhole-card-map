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
