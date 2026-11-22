import type {
  Map as MapLibreMap,
  ExpressionSpecification,
  GeoJSONSource,
} from "maplibre-gl";
import { mapPalette } from "./map-theme";
import { pinsGeoJSON } from "./mapcn-data";
import { japanMaskGeoJSON } from "./japan-mask";
import { SEA_LABELS } from "./basemap-style";
import { countsForMap, type countPins } from "./map-levels";
import type { CardMapProps } from "./card-map";
export const SOURCE = "card-pins";
export const SELECTED = "card-selected";
export const CURRENT = "card-current";
export const PIN_LID = `${SOURCE}-lid`;
export const PIN_PLACE = `${SOURCE}-place`;
export const COUNTS = "card-level-counts";
/** Sea over the neighbours' land, roads and names: the map shows Japan only. */
const JAPAN_MASK = "japan-mask";
/** The marks of a received card, beside the facility pins. */
export const PIN_RECEIPT = `${SOURCE}-receipt`;
export const POINTS = [
  PIN_LID,
  PIN_PLACE,
  `${SELECTED}-lid`,
  `${SELECTED}-place`,
];
const COUNT_INNER = "card-count-inner";
const COUNT_VALUES = "card-count-values";
/** The names beside the count badges, a layer for each kind of badge. */
export const COUNT_NAMES = {
  area: "card-count-names-area",
  pref: "card-count-names-pref",
} as const;
const SELECTION_RING = "card-selection-ring";
const SELECTION_OUTER = "card-selection-outer";
const CURRENT_HALO = "card-current-halo";
const CURRENT_LOCATION = "card-current-location";
// 20 CSS pixels: a 16px state symbol with a 2px theme-colored rim, sampled at 2x.
function square(color: string, status: string, rim: string) {
  const width = 40,
    data = new Uint8Array(width * width * 4);
  for (let y = 0; y < width; y++)
    for (let x = 0; x < width; x++) {
      const offset = (y * width + x) * 4;
      const sx = Math.floor(x / 2) - 2,
        sy = Math.floor(y / 2) - 2;
      const halo = sx < 0 || sy < 0 || sx >= 16 || sy >= 16;
      const border = sx < 2 || sy < 2 || sx >= 14 || sy >= 14;
      const hollow = status === "ended" || status === "unknown";
      const unpainted =
        halo || (!border && (hollow || (status === "suspended" && sx >= 8)));
      const paint = unpainted ? rim : color;
      data[offset] = parseInt(paint.slice(1, 3), 16);
      data[offset + 1] = parseInt(paint.slice(3, 5), 16);
      data[offset + 2] = parseInt(paint.slice(5, 7), 16);
      data[offset + 3] = 255;
    }
  return { width, height: width, data };
}

// Small monochrome badges sit beside the existing status symbol, never repaint it.
function receiptBadge(partial: boolean) {
  const width = 32;
  const data = new Uint8Array(width * width * 4);
  for (let y = 0; y < width; y++)
    for (let x = 0; x < width; x++) {
      const distance = Math.hypot(x - 15.5, y - 15.5);
      if (distance > 15.5) continue;
      const mark = partial
        ? x >= 8 && x <= 23 && y >= 14 && y <= 17
        : (x >= 6 && x <= 14 && Math.abs(y - (x + 7)) < 2) ||
          (x >= 13 && x <= 26 && Math.abs(y - (35 - x)) < 2);
      const value = distance > 13 || mark ? 29 : 255;
      const offset = (y * width + x) * 4;
      data.set([value, value, value, 255], offset);
    }
  return { width, height: width, data };
}

/** Paint transitions run in MapLibre; wait for the expanded ring's first render. */
export function animateSelectionRing(map: MapLibreMap, reducedMotion: boolean) {
  const setRadius = (radius: number, duration: number) => {
    for (const [id, extra] of [
      [SELECTION_RING, 0],
      [SELECTION_OUTER, 3],
    ] as const) {
      map.setPaintProperty(id, "circle-radius-transition", {
        duration,
        delay: 0,
      });
      map.setPaintProperty(id, "circle-radius", radius + extra);
    }
  };
  const shrink = () => {
    map.off("render", shrink);
    // MapLibre TransitionSpecification supports duration/delay, not custom easing.
    setRadius(18, 180);
  };
  if (!reducedMotion) map.on("render", shrink);
  setRadius(reducedMotion ? 18 : 24, 0);
  return () => {
    map.off("render", shrink);
  };
}

// Prefecture sizing is unchanged. Area circles always use their full radius.
// Camera expressions must keep interpolate(zoom) at the property root.
function countRadius(inset = 0, divisor = 1): ExpressionSpecification {
  const radius = (scale: number): ExpressionSpecification => [
    "max",
    0,
    [
      "/",
      [
        "-",
        [
          "*",
          ["get", "radius"],
          ["case", ["==", ["get", "kind"], "area"], 1, scale],
        ],
        inset,
      ],
      divisor,
    ],
  ];
  return [
    "interpolate",
    ["linear"],
    ["zoom"],
    2,
    radius(0.25),
    4,
    radius(0.6),
    6,
    radius(1),
  ] as ExpressionSpecification;
}

export function createMapResources(map: MapLibreMap) {
  const layers: string[] = [];
  const sources: string[] = [];
  const images: string[] = [];
  const addLayer = (layer: Parameters<MapLibreMap["addLayer"]>[0]) => {
    map.addLayer(layer);
    layers.push(layer.id);
  };
  const addSource = (
    id: string,
    data: Parameters<GeoJSONSource["setData"]>[0],
  ) => {
    map.addSource(id, { type: "geojson", data });
    sources.push(id);
  };
  // An image the style already has stays the style's.
  const addImage = (
    id: string,
    image: Parameters<MapLibreMap["addImage"]>[1],
    options?: Parameters<MapLibreMap["addImage"]>[2],
  ) => {
    if (map.hasImage(id)) return;
    map.addImage(id, image, options);
    images.push(id);
  };
  return {
    addLayer,
    addSource,
    addImage,
    /** What the caller adds to the map itself, now or later, to go with the rest. */
    own(added: { layers: string[]; sources: string[] }) {
      layers.push(...added.layers);
      sources.push(...added.sources);
    },
    /** Layers before the sources they draw, and the images they name last. */
    remove() {
      for (const id of layers) if (map.getLayer(id)) map.removeLayer(id);
      for (const id of sources) if (map.getSource(id)) map.removeSource(id);
      // mapcn's parent effect may remove the map before this child cleanup.
      if (map.getStyle())
        for (const id of images) if (map.hasImage(id)) map.removeImage(id);
    },
  };
}

export function installMapResources(
  map: MapLibreMap,
  props: Pick<CardMapProps, "pins" | "selectedPins" | "focus">,
  counts: ReturnType<typeof countPins>,
  dark = false,
  resources = createMapResources(map),
) {
  const palette = mapPalette(dark);
  const { addLayer, addSource, addImage } = resources;
  // First, so it lies over the whole basemap and under every app layer.
  addSource(JAPAN_MASK, japanMaskGeoJSON());
  addLayer({
    id: JAPAN_MASK,
    type: "fill",
    source: JAPAN_MASK,
    paint: { "fill-color": palette.water, "fill-antialias": false },
  });
  for (const id of SEA_LABELS) if (map.getLayer(id)) map.moveLayer(id);
  addSource(SOURCE, pinsGeoJSON(props.pins, dark));
  addSource(SELECTED, pinsGeoJSON(props.selectedPins, dark));
  addSource(CURRENT, pinsGeoJSON([]));
  addSource(
    COUNTS,
    countsForMap(
      map.getZoom(),
      props.focus,
      counts,
      map.getContainer().getBoundingClientRect().width,
    ),
  );
  addLayer({
    id: COUNTS,
    type: "circle",
    source: COUNTS,
    paint: {
      "circle-radius": countRadius(),
      "circle-color": palette.iron,
      "circle-stroke-width": 2,
      "circle-stroke-color": palette.paper,
    },
  });
  addLayer({
    id: COUNT_INNER,
    type: "circle",
    source: COUNTS,
    paint: {
      "circle-radius": countRadius(4),
      "circle-color": "transparent",
      "circle-stroke-width": 1.25,
      "circle-stroke-color": palette.inner,
    },
  });
  if (map.getStyle().glyphs) {
    // Circle layers have no collision boxes. A transparent icon reserves their
    // extent so variable-anchor labels cannot cover another badge or its number.
    const clearance = "card-count-clearance";
    addImage(clearance, {
      width: 64,
      height: 64,
      data: new Uint8Array(64 * 64 * 4),
    });
    // Separate kinds keep the same interaction layers at each map level.
    for (const kind of ["area", "pref"] as const)
      addLayer({
        id: COUNT_NAMES[kind],
        type: "symbol",
        source: COUNTS,
        filter: ["==", ["get", "kind"], kind],
        layout: {
          "text-field": ["get", "name"],
          "text-font": ["Open Sans Regular"],
          "text-size": kind === "area" ? 13 : 12,
          ...(kind === "area"
            ? {
                "text-anchor": ["get", "labelAnchor"],
                "text-offset": ["get", "labelOffset"],
                "text-max-width": 40,
                "text-ignore-placement": true,
                "icon-allow-overlap": true,
              }
            : {
                "text-variable-anchor": ["top", "bottom", "right", "left"],
                "text-radial-offset": 2.5,
              }),
          "text-optional": true,
          "text-allow-overlap": kind === "area",
        },
        paint: {
          "text-color": palette.ink,
          "text-halo-color": palette.paper,
          "text-halo-width": 2,
        },
      });
    // Higher symbol layers reserve collision boxes before the name layers.
    addLayer({
      id: COUNT_VALUES,
      type: "symbol",
      source: COUNTS,
      layout: {
        "icon-image": clearance,
        "icon-size": countRadius(-3, 32),
        "icon-allow-overlap": true,
        "icon-ignore-placement": false,
        "text-field": ["to-string", ["get", "count"]],
        // One face for every level, so counts do not change type when zooming.
        "text-font": ["Montserrat SemiBold"],
        "text-size": ["get", "valueSize"],
        "text-allow-overlap": true,
      },
      paint: { "text-color": palette.onIron },
    });
  }
  for (const [status, color] of Object.entries(palette.pins))
    addImage(`card-square-${status}`, square(color, status, palette.pinRim), {
      pixelRatio: 2,
    });
  if (import.meta.env.VITE_ACCOUNTS_ENABLED === "true")
    for (const state of ["all", "some"])
      addImage(`card-receipt-${state}`, receiptBadge(state === "some"), {
        pixelRatio: 2,
      });
  for (const source of [SOURCE, SELECTED]) {
    const selected = source === SELECTED;
    if (selected) {
      addLayer({
        id: SELECTION_OUTER,
        type: "circle",
        source,
        paint: {
          "circle-radius": 21,
          "circle-color": "transparent",
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
        },
      });
      addLayer({
        id: SELECTION_RING,
        type: "circle",
        source,
        paint: {
          "circle-radius": 18,
          "circle-color": "transparent",
          "circle-stroke-width": 3,
          "circle-stroke-color": palette.selection,
        },
      });
    }
    addLayer({
      id: `${source}-lid`,
      type: "circle",
      source,
      filter: ["==", ["get", "kind"], "lid"],
      paint: {
        "circle-color": ["get", "color"],
        "circle-radius": selected ? 10 : 6,
        "circle-stroke-width": 2,
        "circle-stroke-color": "#ffffff",
      },
    });
    addLayer({
      id: `${source}-place`,
      type: "symbol",
      source,
      filter: ["==", ["get", "kind"], "place"],
      layout: {
        "icon-image": ["concat", "card-square-", ["get", "status"]],
        "icon-size": selected ? 1.25 : 1,
        "icon-allow-overlap": true,
        "icon-ignore-placement": true,
      },
    });
    if (import.meta.env.VITE_ACCOUNTS_ENABLED === "true")
      addLayer({
        id: `${source}-receipt`,
        type: "symbol",
        source,
        filter: [
          "all",
          ["==", ["get", "kind"], "place"],
          ["in", ["get", "receipt"], ["literal", ["all", "some"]]],
        ],
        layout: {
          "icon-image": ["concat", "card-receipt-", ["get", "receipt"]],
          "icon-offset": [10, -10],
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,
        },
      });
  }
  addLayer({
    id: CURRENT_HALO,
    type: "circle",
    source: CURRENT,
    paint: {
      "circle-radius": 16,
      "circle-color": palette.iron,
      "circle-opacity": 0.15,
    },
  });
  addLayer({
    id: CURRENT_LOCATION,
    type: "circle",
    source: CURRENT,
    paint: {
      "circle-radius": 8,
      "circle-color": palette.selection,
      "circle-stroke-width": 3,
      "circle-stroke-color": "#ffffff",
    },
  });
  return resources;
}

export function repaintMapResources(map: MapLibreMap, dark: boolean) {
  const p = mapPalette(dark);
  const paint = (
    id: string,
    key: Parameters<MapLibreMap["setPaintProperty"]>[1],
    value: Parameters<MapLibreMap["setPaintProperty"]>[2],
  ) => {
    if (map.getLayer(id)) map.setPaintProperty(id, key, value);
  };
  paint(JAPAN_MASK, "fill-color", p.water);
  paint(COUNTS, "circle-color", p.iron);
  paint(COUNTS, "circle-stroke-color", p.paper);
  paint(COUNT_INNER, "circle-stroke-color", p.inner);
  paint(COUNT_VALUES, "text-color", p.onIron);
  for (const id of Object.values(COUNT_NAMES)) {
    paint(id, "text-color", p.ink);
    paint(id, "text-halo-color", p.paper);
  }
  paint(SELECTION_RING, "circle-stroke-color", p.selection);
  paint(CURRENT_HALO, "circle-color", p.iron);
  paint(CURRENT_LOCATION, "circle-color", p.selection);
  for (const [status, color] of Object.entries(p.pins))
    if (map.hasImage(`card-square-${status}`))
      map.updateImage(`card-square-${status}`, square(color, status, p.pinRim));
}
