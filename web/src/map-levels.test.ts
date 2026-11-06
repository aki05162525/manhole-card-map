import { expect, test } from "vitest";
import {
  visibleBadges,
  prefectureBordersEmphasized,
  areaBordersEmphasized,
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
        Math.hypot(a[0] - b[0], a[1] - b[1]) * scale,
      ).toBeGreaterThanOrEqual(30);
    }
}
test("30px badges do not overlap on 350x500 Mercator map", () => {
  separated(
    areas.map((a) => a.badge),
    512 * 2 ** 3.2,
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

test("pin filters and tap thresholds", async () => {
  const { pinFilter, tapAction } = await import("./map-levels");
  expect(pinFilter(6, { area: null, pref: null }, "lid")).toBe(false);
  expect(pinFilter(6, { area: null, pref: "東京都" }, "place")).toEqual([
    "all",
    ["==", ["get", "kind"], "place"],
    ["==", ["get", "pref"], "東京都"],
  ]);
  expect(tapAction(8, 17)).toBe("select");
  expect(tapAction(9, 17)).toBe("zoom");
  expect(tapAction(90, 17.5)).toBe("select");
});

test("filters match visibility across thresholds and focus", async () => {
  const { pinFilter } = await import("./map-levels");
  const evaluate = (value: unknown, props: Record<string, string>): unknown => {
    if (!Array.isArray(value)) return value;
    const [op, ...args] = value;
    if (op === "get") return props[args[0]];
    if (op === "==")
      return evaluate(args[0], props) === evaluate(args[1], props);
    if (op === "all") return args.every((arg) => evaluate(arg, props));
    throw new Error(String(op));
  };
  for (const zoom of [3.5, 5.599, 5.6, 6.999, 7, 18]) {
    for (const focus of [
      { area: null, pref: null },
      focusForAreaTap("kanto"),
      focusForPrefTap("東京都"),
    ]) {
      for (const pref of ["東京都", "大阪府"]) {
        expect(
          evaluate(pinFilter(zoom, focus, "place"), { kind: "place", pref }),
        ).toBe(pinVisibility(zoom, focus, pref) !== "hidden");
        expect(
          evaluate(pinFilter(zoom, focus, "lid"), { kind: "lid", pref }),
        ).toBe(zoom >= 7);
        expect(
          evaluate(pinFilter(zoom, focus, "place"), { kind: "lid", pref }),
        ).toBe(false);
      }
    }
  }
});

test("area cameras stay below pin zoom so prefecture counts can be tapped", async () => {
  const { focusCamera, PIN_MIN_ZOOM } = await import("./map-levels");
  const area = focusCamera({ area: "kanto", pref: null });
  expect(area.maxZoom).toBeLessThan(PIN_MIN_ZOOM);
  expect(area.bounds).toEqual(areas.find((a) => a.id === "kanto")?.bounds);
  const pref = focusCamera({ area: "kanto", pref: "東京都" });
  expect(pref.maxZoom).toBe(11);
  expect(pref.bounds).toEqual(
    prefectures.find((p) => p.name === "東京都")?.bounds,
  );
  expect(focusCamera({ area: null, pref: null }).maxZoom).toBeLessThan(
    PIN_MIN_ZOOM,
  );
});

test("prefecture cameras fit pins inside the mainland bounds", async () => {
  const { focusCamera } = await import("./map-levels");
  const tokyo = prefectures.find((p) => p.name === "東京都")!;
  const pins = [
    { pref: "東京都", lng: 139.5, lat: 35.6 },
    { pref: "東京都", lng: 139.7, lat: 35.7 },
    // Ogasawara stays visible as a pin but must not pull the camera out.
    { pref: "東京都", lng: 142.19, lat: 27.09 },
    { pref: "神奈川県", lng: 139.4, lat: 35.4 },
  ];
  const focus = { area: "kanto", pref: "東京都" };
  expect(focusCamera(focus, pins).bounds).toEqual([
    [139.5, 35.6],
    [139.7, 35.7],
  ]);
  expect(focusCamera(focus, []).bounds).toEqual(tokyo.bounds);
  expect(focusCamera(focus, [pins[2]]).bounds).toEqual(tokyo.bounds);
  expect(focusCamera({ area: "kanto", pref: null }, pins).bounds).toEqual(
    areas.find((a) => a.id === "kanto")?.bounds,
  );
});

test("zooming out closes the open prefecture and then the area", async () => {
  const { focusAfterZoomOut } = await import("./map-levels");
  const chiba = { area: "kanto", pref: "千葉県" };
  const kanto = { area: "kanto", pref: null };
  const japan = { area: null, pref: null };
  expect(focusAfterZoomOut(7, chiba, 8.5)).toBe(chiba);
  expect(focusAfterZoomOut(6.99, chiba, 8.5)).toEqual(kanto);
  expect(focusAfterZoomOut(5.6, kanto, 6.6)).toBe(kanto);
  expect(focusAfterZoomOut(5.59, kanto, 6.6)).toEqual(japan);
  expect(focusAfterZoomOut(3, japan, 4)).toBe(japan);
  // Hokkaido opens below the pin zoom, so it needs room to stay open.
  const hokkaido = { area: "hokkaido", pref: "北海道" };
  expect(focusAfterZoomOut(5.6, hokkaido, 5.6)).toBe(hokkaido);
  expect(focusAfterZoomOut(5.1, hokkaido, 5.6)).toBe(hokkaido);
  expect(focusAfterZoomOut(5.09, hokkaido, 5.6)).toEqual(japan);
  // A wide area view opened below the count boundary behaves the same way.
  const tohoku = { area: "tohoku", pref: null };
  expect(focusAfterZoomOut(5.2, tohoku, 5.4)).toBe(tohoku);
  expect(focusAfterZoomOut(4.8, tohoku, 5.4)).toEqual(japan);
});

test("regional badges stay at their land and Tokyo anchors", () => {
  for (const [id, badge] of Object.entries({
    kanto: [139.8, 35.7],
    chubu: [137.5, 36.1],
    kinki: [135.8, 34.78],
    chugoku: [133, 35.3],
    shikoku: [133.1, 33.35],
    kyushu: [130.6, 32.7],
  })) {
    expect(areas.find((area) => area.id === id)?.badge).toEqual(badge);
  }
});

test("prefecture badges stay on mainland anchors", () => {
  expect(prefectures.find((p) => p.name === "島根県")?.badge).toEqual([
    132.5, 35,
  ]);
  expect(prefectures.find((p) => p.name === "鳥取県")?.badge).toEqual([
    133.82, 35.33,
  ]);
});

test("prefecture borders switch with prefecture badges and remain dark above pin zoom", () => {
  const empty = { area: null, pref: null };
  expect(prefectureBordersEmphasized(5.59, empty)).toBe(false);
  expect(prefectureBordersEmphasized(5.6, empty)).toBe(true);
  expect(prefectureBordersEmphasized(7, empty)).toBe(true);
  const focuses = [null, ...areas.map((a) => a.id)].flatMap((area) =>
    [null, ...prefectures.map((p) => p.name)].map((pref) => ({ area, pref })),
  );
  for (const zoom of [3, 5.59, 5.6, 6.99, 7, 18]) {
    for (const focus of focuses) {
      const dark = prefectureBordersEmphasized(zoom, focus);
      expect(dark).toBe(zoom >= 5.6 || focus.area !== null);
      if (visibleBadges(zoom, focus).some((b) => b.kind === "pref"))
        expect(dark).toBe(true);
    }
  }
});

test("area borders and area numbers agree for every focus and threshold", () => {
  for (const area of [null, ...areas.map((a) => a.id)])
    for (const pref of [null, ...prefectures.map((p) => p.name)])
      for (const zoom of [2, 5, 5.5, 5.5999, 5.6, 6.5, 6.9999, 7, 7.1, 18])
        expect(areaBordersEmphasized(zoom, { area, pref })).toBe(
          visibleBadges(zoom, { area, pref }).some((b) => b.kind === "area"),
        );
});

test("prefecture numbers and borders agree for every focus, except a selected sole prefecture has its pins", () => {
  for (const area of [null, ...areas.map((a) => a.id)])
    for (const pref of [null, ...prefectures.map((p) => p.name)])
      for (const zoom of [2, 5, 5.5, 5.5999, 5.6, 6.5, 6.9999, 7, 7.1, 18]) {
        const focus = { area, pref };
        const soleSelected =
          areas.find((a) => a.id === area)?.prefs.length === 1 &&
          areas.find((a) => a.id === area)?.prefs[0] === pref;
        expect(prefectureBordersEmphasized(zoom, focus)).toBe(
          zoom >= 7 ||
            soleSelected ||
            visibleBadges(zoom, focus).some((b) => b.kind === "pref"),
        );
      }
});
