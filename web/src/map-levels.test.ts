import { expect, test } from "vitest";
import {
  visibleBadges,
  pinVisibility,
  parentFocus,
  focusForAreaTap,
  focusForPrefTap,
  countPins,
  countsGeoJSON,
} from "./map-levels";
import { prefectures, areas } from "./prefectures";
test("coverage", () => {
  expect(prefectures).toHaveLength(47);
  expect(areas).toHaveLength(9);
  expect(new Set(areas.flatMap((a) => a.prefs)).size).toBe(47);
  for (const p of prefectures)
    expect(areas.filter((a) => a.prefs.includes(p.name))).toHaveLength(1);
});
test("boundaries and navigation", () => {
  const empty = { area: null, pref: null };
  expect(visibleBadges(5.599, empty)).toHaveLength(9);
  expect(visibleBadges(5.6, empty)).toHaveLength(47);
  expect(visibleBadges(7, empty)).toHaveLength(0);
  for (const p of prefectures) {
    const f = focusForPrefTap(p.name);
    expect(pinVisibility(6, f, p.name)).toBe("normal");
    expect(pinVisibility(7, f, "other")).toBe("dim");
    expect(pinVisibility(6, f, "other")).toBe("hidden");
    expect(visibleBadges(4, f).some((b) => b.id === p.name)).toBe(false);
    expect(parentFocus(f)).toEqual(
      ["北海道", "沖縄県"].includes(p.name)
        ? empty
        : { area: p.area, pref: null },
    );
  }
  for (const a of areas) {
    expect(focusForAreaTap(a.id)).toEqual({
      area: a.id,
      pref: a.prefs.length === 1 ? a.prefs[0] : null,
    });
    expect(parentFocus({ area: a.id, pref: null })).toEqual(empty);
    expect(
      visibleBadges(4, { area: a.id, pref: null }).filter(
        (b) => b.kind === "pref",
      ),
    ).toHaveLength(a.prefs.length);
  }
  expect(pinVisibility(7, empty, "東京都")).toBe("normal");
  const counts = countPins([
    { pref: "東京都" },
    { pref: "東京都" },
    { pref: "" },
  ]);
  expect(counts.prefs["東京都"]).toBe(2);
  expect(counts.areas.kanto).toBe(2);
  expect(
    countsGeoJSON(6, empty, counts).features.find(
      (f) => f.properties.id === "東京都",
    )?.properties.count,
  ).toBe(2);
});
function merc([lng, lat]: number[]) {
  return [
    lng / 360,
    -Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) / (2 * Math.PI),
  ];
}
function separated(points: number[][], scale: number) {
  for (let i = 0; i < points.length; i++)
    for (let j = i + 1; j < points.length; j++) {
      const a = merc(points[i]),
        b = merc(points[j]);
      expect(
        Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1])) * scale,
      ).toBeGreaterThanOrEqual(30);
    }
}
test("30px badges do not overlap on 350x500 Mercator map", () => {
  separated(
    areas.map((a) => a.badge),
    512 * 2 ** 4,
  );
  for (const a of areas) {
    const lo = merc(a.bounds[0]),
      hi = merc(a.bounds[1]);
    const scale = Math.min(
      350 / Math.abs(hi[0] - lo[0]),
      500 / Math.abs(hi[1] - lo[1]),
    );
    separated(
      prefectures.filter((p) => p.area === a.id).map((p) => p.badge),
      scale,
    );
  }
});
