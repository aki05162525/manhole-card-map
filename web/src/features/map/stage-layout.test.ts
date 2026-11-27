import { expect, it } from "vitest";
import { countsForMap, focusCamera } from "./map-levels";
import { countPins } from "../../domain/map-summary";
import { stageCamera } from "./stage-camera";
import {
  badgeReach,
  badgesCrowded,
  badgesOverlap,
  type Spot,
} from "./stage-layout";

// The badges of a level as the stage places them on a screen of this size,
// below a search bar and a trail of the usual height.
function spots(width: number, height: number, area: string | null): Spot[] {
  const focus = { area, pref: null };
  const camera = stageCamera(width, height, {
    ...focusCamera(focus),
    padding:
      area === null
        ? { top: 72, bottom: 16, left: 8, right: 8 }
        : { top: 130, bottom: 20, left: 24, right: 24 },
  });
  return countsForMap(camera.zoom, focus, countPins([]), width)
    .features.filter(({ properties: p }) => area === null || p.kind === "pref")
    .map(({ geometry, properties: p }) => ({
      x: camera.x(geometry.coordinates[0]),
      y: camera.y(geometry.coordinates[1]),
      radius: p.radius,
      name: p.name,
    }));
}
const kanto = (width: number, height: number) =>
  spots(width, height, "kanto").filter((spot) =>
    [
      "茨城県",
      "栃木県",
      "群馬県",
      "埼玉県",
      "千葉県",
      "東京都",
      "神奈川県",
    ].includes(spot.name),
  );

// The nine regions fit a phone and a desktop; on a phone held sideways
// their circles lie over each other, as on the drawn map.
it.each([
  [320, 568],
  [412, 915],
  [1366, 800],
])(
  "gives a press on a region's circle to that region alone at %i×%i",
  (width, height) => {
    const placed = spots(width, height, null);
    const reach = badgeReach(placed);
    expect(placed).toHaveLength(9);
    expect(badgesOverlap(placed)).toBe(false);
    placed.forEach((a, i) => {
      expect(reach[i]).toBeGreaterThanOrEqual(a.radius);
      expect(reach[i]).toBeLessThanOrEqual(22);
      placed.forEach((b, j) => {
        if (i < j)
          expect(
            reach[i] + reach[j],
            `${a.name} and ${b.name}`,
          ).toBeLessThanOrEqual(Math.hypot(a.x - b.x, a.y - b.y) + 1e-9);
      });
    });
  },
);

it("finds the regions' circles over each other on a phone held sideways", () => {
  expect(badgesOverlap(spots(667, 375, null))).toBe(true);
});

it("reaches a fingertip's width around a badge with room, and half the gap beside a neighbour", () => {
  const badge = (x: number, radius = 14): Spot => ({
    x,
    y: 0,
    radius,
    name: "",
  });
  expect(badgeReach([badge(0)])).toEqual([22]);
  expect(badgeReach([badge(0), badge(100)])).toEqual([22, 22]);
  // 8px between the circles: 4px more for each.
  expect(badgeReach([badge(0), badge(36)])).toEqual([18, 18]);
  // Circles that touch or overlap keep their own radius.
  expect(badgeReach([badge(0, 16), badge(20, 13)])).toEqual([16, 13]);
});

// Kanto's seven on a small phone and on one held sideways: the names lie
// over the next circles and the fingertips' reaches meet.
it.each([
  [320, 568],
  [667, 375],
])("finds Kanto's badges crowded at %i×%i", (width, height) => {
  expect(badgesCrowded(kanto(width, height), 12)).toBe(true);
});

it("finds Kanto's badges clear on a desktop", () => {
  expect(badgesCrowded(kanto(1366, 800), 12)).toBe(false);
});

it("finds a name crowded when it lies over another badge or name", () => {
  const badge = (x: number, y: number, name: string): Spot => ({
    x,
    y,
    radius: 16,
    name,
  });
  // 50px apart: the reaches are clear, and so is each name under its own.
  expect(
    badgesCrowded([badge(0, 0, "東京都"), badge(50, 0, "千葉県")], 12),
  ).toBe(false);
  // Four characters at twice the size meet the three beside them.
  expect(
    badgesCrowded([badge(0, 0, "神奈川県"), badge(70, 0, "千葉県")], 24),
  ).toBe(true);
  // The badge below sits where the name above is written.
  expect(
    badgesCrowded([badge(0, 0, "東京都"), badge(0, 46, "神奈川県")], 12),
  ).toBe(true);
});
