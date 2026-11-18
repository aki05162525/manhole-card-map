import { expect, it } from "vitest";
import { installMapResources } from "./map-resources";
import { fakeMapLibre } from "./fake-maplibre";

const noPins = {
  pins: [],
  selectedPins: [],
  focus: { area: null, pref: null },
};
const noCounts = { areas: {}, prefs: {} };
it("renders state shapes as pixels", () => {
  // A style without glyphs: no count labels.
  const fake = fakeMapLibre({ zoom: 14, width: 1440, glyphs: false });
  installMapResources(fake.maplibre, noPins, noCounts, [], []);
  expect(
    fake.layer("symbol", "card-pins-place").layout?.["icon-image"],
  ).toEqual(["concat", "card-square-", ["get", "status"]]);
  const pixel = (id: string, x: number, y: number) =>
    Array.from(
      fake.images
        .get(`card-square-${id}`)!
        .data.slice((y * 40 + x) * 4, (y * 40 + x) * 4 + 4),
    );
  expect(pixel("active", 0, 20)).toEqual([255, 255, 255, 255]);
  expect(pixel("ended", 20, 20)).toEqual([255, 255, 255, 255]);
  expect(pixel("suspended", 12, 20)).not.toEqual(pixel("suspended", 26, 20));
});

it.each([false, true])(
  "uses a native 180ms ring paint transition and cancels its render listener (reduced=%s)",
  async (reduced) => {
    const { animateSelectionRing } = await import("./map-resources");
    const fake = fakeMapLibre();
    const writes = fake.map.setPaintProperty.mock.calls;
    const rendering = () => fake.listeners.get("render")?.size ?? 0;
    const cancel = animateSelectionRing(fake.maplibre, reduced);
    expect(writes).toContainEqual([
      "card-selection-ring",
      "circle-radius",
      reduced ? 18 : 24,
    ]);
    if (!reduced) {
      expect(rendering()).toBe(1);
      fake.emit("render");
      expect(writes).toContainEqual([
        "card-selection-ring",
        "circle-radius-transition",
        { duration: 180, delay: 0 },
      ]);
      expect(writes).toContainEqual([
        "card-selection-ring",
        "circle-radius",
        18,
      ]);
    }
    expect(rendering()).toBe(0);
    cancel();
    expect(rendering()).toBe(0);
  },
);

it("labels area and prefecture badges with place names only", () => {
  const fake = fakeMapLibre({ width: 1440 });
  installMapResources(fake.maplibre, noPins, noCounts, [], []);
  expect(
    fake.layer("symbol", "card-count-values").layout?.["text-size"],
  ).toEqual(["get", "valueSize"]);
  for (const kind of ["area", "pref"]) {
    const field = fake.layer("symbol", `card-count-names-${kind}`).layout?.[
      "text-field"
    ];
    expect(field).toEqual(["get", "name"]);
  }
});

it("E1 reserves collision space for badges and lets all area labels avoid it", () => {
  const fake = fakeMapLibre({ width: 1440 });
  installMapResources(fake.maplibre, noPins, noCounts, [], []);
  for (const kind of ["area", "pref"]) {
    const layout = fake.layer("symbol", `card-count-names-${kind}`).layout;
    if (kind === "pref") {
      expect(layout?.["text-allow-overlap"]).toBe(false);
      expect(layout?.["text-variable-anchor"]).toEqual([
        "top",
        "bottom",
        "right",
        "left",
      ]);
      expect(layout?.["text-radial-offset"]).toBeGreaterThanOrEqual(2);
    } else {
      expect(layout?.["text-allow-overlap"]).toBe(true);
      expect(layout?.["icon-allow-overlap"]).toBe(true);
      expect(layout?.["text-variable-anchor"]).toBeUndefined();
      expect(layout?.["text-anchor"]).toEqual(["get", "labelAnchor"]);
      expect(layout?.["text-offset"]).toEqual(["get", "labelOffset"]);
    }
  }
  const order = [...fake.layers.keys()];
  expect(order.indexOf("card-count-names-area")).toBeLessThan(
    order.indexOf("card-count-values"),
  );
  const radius = fake.layer("circle", "card-level-counts").paint?.[
    "circle-radius"
  ];
  expect(Array.isArray(radius) && radius[0]).toBe("interpolate");
  expect(
    fake.layer("symbol", "card-count-values").layout?.["icon-ignore-placement"],
  ).toBe(false);
});

it("national numbers fit an unscaled circle at both national zooms", () => {
  const fake = fakeMapLibre({ width: 1440 });
  installMapResources(fake.maplibre, noPins, noCounts, [], []);
  const expression = fake.layer("circle", "card-level-counts").paint?.[
    "circle-radius"
  ];
  const evaluate = (value: any, zoom: number, radius: number): any => {
    if (!Array.isArray(value)) return value;
    const [op, ...args] = value;
    const e = (v: any) => evaluate(v, zoom, radius);
    if (op === "get") return args[0] === "kind" ? "area" : radius;
    if (op === "zoom") return zoom;
    if (op === "==") return e(args[0]) === e(args[1]);
    if (op === "case") return e(args[0]) ? e(args[1]) : e(args[2]);
    if (op === "max") return Math.max(...args.map(e));
    if (op === "*") return e(args[0]) * e(args[1]);
    if (op === "-") return e(args[0]) - e(args[1]);
    if (op === "/") return e(args[0]) / e(args[1]);
    if (op === "interpolate") {
      const z = e(args[1]);
      if (z <= args[2]) return e(args[3]);
      for (let i = 4; i < args.length; i += 2)
        if (z < args[i]) {
          const t = (z - args[i - 2]) / (args[i] - args[i - 2]);
          return e(args[i - 1]) * (1 - t) + e(args[i + 1]) * t;
        }
      return e(args.at(-1));
    }
    throw Error(op);
  };
  for (const zoom of [2, 3.85, 4.1, 6])
    for (const radius of [16, 18, 26])
      expect(evaluate(expression, zoom, radius)).toBeCloseTo(radius);
});

it("uses a paper rim and hollow fill at night, recreates images on changes, and restores light pixels", async () => {
  const { repaintMapResources } = await import("./map-resources");
  const fake = fakeMapLibre({ zoom: 14, width: 1440, glyphs: false });
  installMapResources(fake.maplibre, noPins, noCounts, [], []);
  const light = new Map(
    [...fake.images].map(([id, image]) => [id, new Uint8Array(image.data)]),
  );
  repaintMapResources(fake.maplibre, true);
  const pixel = (id: string, x: number, y: number) =>
    Array.from(
      fake.images
        .get(`card-square-${id}`)!
        .data.slice((y * 40 + x) * 4, (y * 40 + x) * 4 + 4),
    );
  for (const status of ["active", "upcoming", "suspended", "ended", "unknown"])
    expect(pixel(status, 0, 20)).toEqual([20, 24, 22, 255]);
  expect(pixel("ended", 20, 20)).toEqual([20, 24, 22, 255]);
  expect(
    fake.layer("circle", "card-selection-outer").paint?.["circle-stroke-color"],
  ).toBe("#ffffff");
  repaintMapResources(fake.maplibre, false);
  for (const [id, data] of light)
    expect(fake.images.get(id)!.data).toEqual(data);
});
