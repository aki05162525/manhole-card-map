import { expect, it } from "vitest";
import { installMapResources } from "./map-resources";
import { colors } from "./types";
import type { Map as MapLibreMap } from "maplibre-gl";
import type { CardMapProps } from "./card-map";
it("renders sixteen-pixel state shapes, dashed references and a two-color iron selection ring", () => {
  const layers: any[] = [];
  const ratios = new Map<string, number>();
  const images = new Map<string, { width: number; data: Uint8Array }>();
  const map = {
    addSource() {},
    addLayer(layer: unknown) {
      layers.push(layer);
    },
    hasImage() {
      return false;
    },
    addImage(id: string, image: any, options: { pixelRatio: number }) {
      ratios.set(id, options.pixelRatio);
      images.set(id, image);
    },
    getZoom() {
      return 14;
    },
    getStyle() {
      return {};
    },
  };
  installMapResources(
    map as unknown as MapLibreMap,
    {
      pins: [],
      selectedPins: [],
      focus: { kind: "national" },
    } as unknown as CardMapProps,
    {} as never,
    [],
    [],
  );
  const badge = layers.find((l) => l.id === "card-level-counts");
  expect(badge.paint).toMatchObject({
    "circle-radius": expect.arrayContaining(["interpolate"]),
    "circle-color": "#1d2321",
    "circle-stroke-color": "#f3f1ec",
    "circle-stroke-width": 2,
  });
  expect(layers.find((l) => l.id === "card-count-inner").paint).toMatchObject({
    "circle-radius": expect.arrayContaining(["interpolate"]),
    "circle-stroke-width": 1.25,
    "circle-stroke-color": "rgba(255,255,255,0.5)",
  });
  expect(
    layers.find((l) => l.id === "card-current-location").paint["circle-color"],
  ).toBe("#1d2321");
  expect(colors.suspended).toBe("#8a5a00");
  expect(colors.ended).toBe("#5b6461");
  const place = layers.find((l) => l.id === "card-pins-place");
  expect(place.layout["icon-size"]).toBe(1);
  expect(JSON.stringify(place.layout["icon-image"])).toContain("reference");
  const ring = layers.find((l) => l.id === "card-selection-ring");
  expect(ring.paint["circle-radius"]).toBe(18);
  expect(ring.paint["circle-stroke-width"]).toBe(3);
  expect(ring.paint["circle-stroke-color"]).toBe("#1d2321");
  const outer = layers.find((l) => l.id === "card-selection-outer");
  expect(outer.paint["circle-radius"]).toBe(21);
  expect(outer.paint["circle-stroke-width"]).toBe(2);
  for (const status of ["active", "suspended", "ended", "reference"])
    expect(images.get(`card-square-${status}`)?.width).toBe(40);
  expect(ratios.get("card-square-active")).toBe(2);
  expect(
    layers.find((l) => l.id === "card-selected-place").layout["icon-size"],
  ).toBe(1.25);
  const pixel = (id: string, x: number, y: number) =>
    Array.from(
      images
        .get(`card-square-${id}`)!
        .data.slice((y * 40 + x) * 4, (y * 40 + x) * 4 + 4),
    );
  expect(pixel("active", 0, 20)).toEqual([255, 255, 255, 255]);
  expect(pixel("ended", 20, 20)).toEqual([255, 255, 255, 255]);
  expect(pixel("suspended", 12, 20)).not.toEqual(pixel("suspended", 26, 20));
  expect(pixel("reference", 18, 4)[3]).toBe(0);
});

it.each([false, true])(
  "uses a native 180ms ring paint transition and cancels its render listener (reduced=%s)",
  async (reduced) => {
    const { animateSelectionRing } = await import("./map-resources");
    const writes: Array<[string, string, unknown]> = [];
    let render: (() => void) | undefined;
    const map = {
      setPaintProperty(id: string, key: string, value: unknown) {
        writes.push([id, key, value]);
      },
      on(_name: string, fn: () => void) {
        render = fn;
      },
      off(_name: string, fn: () => void) {
        if (render === fn) render = undefined;
      },
    };
    const cancel = animateSelectionRing(map as unknown as MapLibreMap, reduced);
    expect(writes).toContainEqual([
      "card-selection-ring",
      "circle-radius",
      reduced ? 18 : 24,
    ]);
    if (!reduced) {
      render!();
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
    } else expect(render).toBeUndefined();
    cancel();
    expect(render).toBeUndefined();
  },
);

it("E1 reserves collision space for badges and lets all area labels avoid it", () => {
  const layers: any[] = [];
  const map = {
    addSource() {},
    addLayer: (layer: unknown) => layers.push(layer),
    hasImage: () => false,
    addImage() {},
    getZoom: () => 4,
    getStyle: () => ({ glyphs: "glyphs" }),
  };
  installMapResources(
    map as unknown as MapLibreMap,
    {
      pins: [],
      selectedPins: [],
      focus: { area: null, pref: null },
    } as unknown as CardMapProps,
    { areas: {}, prefs: {} },
    [],
    [],
  );
  for (const kind of ["area", "pref"]) {
    const layout = layers.find(
      (l) => l.id === `card-count-names-${kind}`,
    ).layout;
    expect(layout["text-allow-overlap"]).toBe(false);
    expect(layout["text-variable-anchor"]).toEqual([
      "top",
      "bottom",
      "right",
      "left",
    ]);
    expect(layout["text-radial-offset"]).toBeGreaterThanOrEqual(2);
  }
  expect(
    layers.findIndex((l) => l.id === "card-count-names-area"),
  ).toBeLessThan(layers.findIndex((l) => l.id === "card-count-values"));
  const badge = layers.find((l) => l.id === "card-level-counts");
  expect(badge.paint["circle-radius"][0]).toBe("interpolate");
  expect(
    layers.find((l) => l.id === "card-count-values").layout[
      "icon-ignore-placement"
    ],
  ).toBe(false);
});
