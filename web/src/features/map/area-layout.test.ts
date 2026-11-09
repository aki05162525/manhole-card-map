import { expect, it } from "vitest";
import { nationalCameraPadding } from "./area-layout";
import { areas, prefectures } from "../../prefectures";
import { countsGeoJSON, focusCamera } from "./map-levels";
const national = { area: null, pref: null };
// Distribution-site counts from the saved data evaluated on 2026-11-06.
const observed = [67, 100, 454, 212, 109, 63, 65, 78, 11];
// A conservative full-width estimate, including the halo around the text.
const FONT = 13,
  HALO = 2;
function merc([lng, lat]: number[]) {
  return [
    lng / 360,
    -Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) / (2 * Math.PI),
  ];
}
function projected(width: number, height: number, counts: number[]) {
  const bounds = focusCamera(national).bounds.map(merc);
  const padding = nationalCameraPadding(width <= 1000 ? 64 : 72);
  const scale = Math.min(
    (width - padding.left - padding.right) / (bounds[1][0] - bounds[0][0]),
    (height - padding.top - padding.bottom) / (bounds[0][1] - bounds[1][1]),
  );
  const center = [
    (bounds[0][0] + bounds[1][0]) / 2,
    (bounds[0][1] + bounds[1][1]) / 2,
  ];
  const points = countsGeoJSON(3.8, national, {
    areas: Object.fromEntries(areas.map((a, i) => [a.id, counts[i]])),
    prefs: {},
  }).features;
  return points.map((f) => {
    const m = merc(f.geometry.coordinates),
      r = f.properties.radius;
    const x =
        (m[0] - center[0]) * scale + (width + padding.left - padding.right) / 2,
      y =
        (m[1] - center[1]) * scale +
        (height + padding.top - padding.bottom) / 2;
    const text = f.properties.name;
    const textWidth = text.length * FONT;
    const { labelAnchor: anchor, labelOffset } = f.properties;
    const offset = labelOffset![0] * FONT;
    const left = x + offset - (anchor === "right" ? textWidth : 0);
    return {
      id: f.properties.id,
      x,
      y,
      r: r + 2,
      anchor,
      rect: {
        left: left - HALO,
        right: left + textWidth + HALO,
        top: y - (FONT * 1.2) / 2 - HALO,
        bottom: y + (FONT * 1.2) / 2 + HALO,
      },
    };
  });
}
function circleRect(
  circle: ReturnType<typeof projected>[number],
  rect: ReturnType<typeof projected>[number]["rect"],
) {
  return (
    Math.hypot(
      circle.x - Math.max(rect.left, Math.min(circle.x, rect.right)),
      circle.y - Math.max(rect.top, Math.min(circle.y, rect.bottom)),
    ) <
    circle.r - 0.01
  );
}
it("fits Japan's main islands rather than continental margins", () => {
  expect(nationalCameraPadding(64)).toEqual({
    left: 16,
    right: 16,
    top: 72,
    bottom: 16,
  });
  expect(nationalCameraPadding(72)).toEqual({
    left: 16,
    right: 16,
    top: 80,
    bottom: 16,
  });
  expect(focusCamera(national).bounds).toEqual([
    [127.5, 26],
    [146, 45.6],
  ]);
});
for (const [width, height] of [
  [412, 915],
  [1440, 900],
]) {
  it(`keeps all circles and adjacent labels separate at ${width}×${height}`, () => {
    const points = projected(width, height, observed);
    const conflicts: string[] = [];
    for (const a of points) {
      expect(["left", "right"]).toContain(a.anchor);
      expect(a.y - a.r).toBeGreaterThanOrEqual(width <= 1000 ? 72 : 80);
      expect(a.y + a.r).toBeLessThanOrEqual(height);
      expect(a.rect.top).toBeGreaterThanOrEqual(width <= 1000 ? 72 : 80);
      expect(a.rect.bottom).toBeLessThanOrEqual(height);
      expect(a.x - a.r).toBeGreaterThanOrEqual(0);
      expect(a.x + a.r).toBeLessThanOrEqual(width);
      expect(a.rect.left).toBeGreaterThanOrEqual(0);
      expect(a.rect.right).toBeLessThanOrEqual(width);
      for (const b of points) {
        if (a !== b && Math.hypot(a.x - b.x, a.y - b.y) < a.r + b.r)
          conflicts.push(`${a.id}/${b.id}: circles`);
        if (circleRect(a, b.rect))
          conflicts.push(`${a.id}/${b.id}: circle/label`);
        if (
          a !== b &&
          a.rect.left < b.rect.right &&
          a.rect.right > b.rect.left &&
          a.rect.top < b.rect.bottom &&
          a.rect.bottom > b.rect.top
        )
          conflicts.push(`${a.id}/${b.id}: labels`);
      }
    }
    expect(conflicts).toEqual([]);
  });
}
it("keeps display locations near the corresponding region", () => {
  const features = countsGeoJSON(3.8, national, {
    areas: {},
    prefs: {},
  }).features;
  for (const f of features) {
    const actual = areas.find((a) => a.id === f.properties.id)!.badge;
    const [lng, lat] = f.geometry.coordinates;
    expect(Math.hypot(lng - actual[0], lat - actual[1])).toBeLessThanOrEqual(
      1.5,
    );
  }
});

it("keeps display locations within each region's mainland envelope", () => {
  const features = countsGeoJSON(3.8, national, {
    areas: {},
    prefs: {},
  }).features;
  for (const f of features) {
    const members = prefectures.filter((p) => p.area === f.properties.id);
    // Multiple prefectures: envelope of their representative points, excluding
    // remote islands. Single prefecture: its generated mainland bounds.
    // This is a coarse regression guard, not a coastline containment test.
    const bounds =
      members.length === 1
        ? members[0].bounds
        : [
            [
              Math.min(...members.map((p) => p.badge[0])),
              Math.min(...members.map((p) => p.badge[1])),
            ],
            [
              Math.max(...members.map((p) => p.badge[0])),
              Math.max(...members.map((p) => p.badge[1])),
            ],
          ];
    for (const axis of [0, 1]) {
      expect(
        f.geometry.coordinates[axis],
        f.properties.id,
      ).toBeGreaterThanOrEqual(bounds[0][axis]);
      expect(f.geometry.coordinates[axis], f.properties.id).toBeLessThanOrEqual(
        bounds[1][axis],
      );
    }
  }
});

it("keeps names free of numbers and place-count units at both levels", () => {
  for (const zoom of [3.8, 6]) {
    const features = countsGeoJSON(zoom, national, {
      areas: {},
      prefs: {},
    }).features;
    expect(features).toHaveLength(zoom < 5.6 ? 9 : 47);
    for (const f of features)
      expect(f.properties.name).not.toMatch(/[0-9０-９]|か所/);
  }
});

it("fits the digits in their circle and keeps labels four pixels beside it", async () => {
  const { areaBadgeRadius, AREA_LAYOUT } = await import("./area-layout");
  expect(Object.keys(AREA_LAYOUT).sort()).toEqual(
    areas.map((a) => a.id).sort(),
  );
  for (const count of [0, 1, 11, 67, 100, 109, 212, 454, 999, 1313]) {
    const radius = areaBadgeRadius(count),
      digits = String(count).length;
    expect(radius).toBeGreaterThanOrEqual(digits >= 3 ? 18 : 14);
    expect(radius).toBeGreaterThanOrEqual(16);
    expect(radius).toBeLessThanOrEqual(26);
    // 13px Open Sans numerals conservatively estimated at 0.65em per digit.
    expect(
      Math.hypot((digits * 13 * 0.65) / 2, 13 / 2) + 2,
    ).toBeLessThanOrEqual(radius);
  }
  const features = countsGeoJSON(3.8, national, {
    areas: Object.fromEntries(areas.map((a, i) => [a.id, observed[i]])),
    prefs: {},
  }).features;
  for (const f of features) {
    const { labelOffset, labelAnchor, radius } = f.properties;
    expect(Math.abs(labelOffset![0]) * FONT).toBeCloseTo(radius + 4);
    expect(labelOffset![1]).toBe(0);
    expect(Math.sign(labelOffset![0])).toBe(labelAnchor === "left" ? 1 : -1);
  }
});
