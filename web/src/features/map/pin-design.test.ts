import { expect, it } from "vitest";
import { installMapResources } from "./map-resources";
import { colors } from "./types";
import type { Map as MapLibreMap } from "maplibre-gl";
import type { CardMapProps } from "./card-map";
it("renders sixteen-pixel state shapes, dashed references and a two-color iron selection ring", () => {
  const layers: any[] = [];
  const images = new Map<string, { width: number; data: Uint8Array }>();
  const map = {
    addSource() {},
    addLayer(layer: unknown) {
      layers.push(layer);
    },
    hasImage() {
      return false;
    },
    addImage(id: string, image: any) {
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
    expect(images.get(`card-square-${status}`)?.width).toBe(16);
  const pixel = (id: string, x: number, y: number) =>
    Array.from(
      images
        .get(`card-square-${id}`)!
        .data.slice((y * 16 + x) * 4, (y * 16 + x) * 4 + 4),
    );
  expect(pixel("ended", 8, 8)).toEqual([255, 255, 255, 255]);
  expect(pixel("suspended", 4, 8)).not.toEqual(pixel("suspended", 11, 8));
  expect(pixel("reference", 7, 0)[3]).toBe(0);
});
