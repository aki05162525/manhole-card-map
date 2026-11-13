import type { Map as MapLibreMap, ExpressionSpecification } from "maplibre-gl";
import { mapPalette } from "./map-theme";
import { pinsGeoJSON } from "./mapcn-data";
import { japanMaskGeoJSON } from "./japan-mask";
import { SEA_LABELS } from "./basemap-style";
import { countsGeoJSON, type countPins, type MapFocus } from "./map-levels";
import type { CardMapProps } from "./card-map";
/** Compact national badges depend on map width, never on device detection. */
export function countsForMap(
  zoom: number,
  focus: MapFocus,
  counts: ReturnType<typeof countPins>,
  width: number,
) {
  const data = countsGeoJSON(zoom, focus, counts);
  return {
    ...data,
    features: data.features.map((feature) => {
      const p = feature.properties;
      const compact = width < 600 && p.kind === "area";
      const radius = compact
        ? [13, 14, 16][Math.min(2, String(Math.max(0, p.count)).length - 1)]
        : p.radius;
      return {
        ...feature,
        properties: {
          ...p,
          radius,
          valueSize: compact ? 11 : 13,
          ...(p.kind === "area"
            ? {
                labelOffset: [
                  ((p.labelAnchor === "left" ? 1 : -1) * (radius + 4)) / 13,
                  0,
                ] as [number, number],
              }
            : {}),
        },
      };
    }),
  };
}
export const SOURCE = "card-pins";
export const SELECTED = "card-selected";
export const CURRENT = "card-current";
export const PIN_LID = `${SOURCE}-lid`;
export const PIN_PLACE = `${SOURCE}-place`;
export const COUNTS = "card-level-counts";
/** Sea over the neighbours' land, roads and names: the map shows Japan only. */
export const JAPAN_MASK = "japan-mask";
export const POINTS = [
  PIN_LID,
  PIN_PLACE,
  "card-selected-lid",
  "card-selected-place",
];
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
      ["card-selection-ring", 0],
      ["card-selection-outer", 3],
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

export function installMapResources(
  map: MapLibreMap,
  props: CardMapProps,
  counts: ReturnType<typeof countPins>,
  layers: string[],
  imageIds: string[],
  dark = false,
) {
  const palette = mapPalette(dark);
  const addLayer = (layer: Parameters<MapLibreMap["addLayer"]>[0]) => {
    map.addLayer(layer);
    layers.push(layer.id);
  };
  // First, so it lies over the whole basemap and under every app layer.
  map.addSource(JAPAN_MASK, { type: "geojson", data: japanMaskGeoJSON() });
  addLayer({
    id: JAPAN_MASK,
    type: "fill",
    source: JAPAN_MASK,
    paint: { "fill-color": palette.water, "fill-antialias": false },
  });
  for (const id of SEA_LABELS) if (map.getLayer(id)) map.moveLayer(id);
  map.addSource(SOURCE, {
    type: "geojson",
    data: pinsGeoJSON(props.pins, dark),
  });
  map.addSource(SELECTED, {
    type: "geojson",
    data: pinsGeoJSON(props.selectedPins, dark),
  });
  map.addSource(CURRENT, { type: "geojson", data: pinsGeoJSON([]) });
  map.addSource(COUNTS, {
    type: "geojson",
    data: countsForMap(
      map.getZoom(),
      props.focus,
      counts,
      map.getContainer().getBoundingClientRect().width,
    ),
  });
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
    id: "card-count-inner",
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
    if (!map.hasImage(clearance)) {
      map.addImage(clearance, {
        width: 64,
        height: 64,
        data: new Uint8Array(64 * 64 * 4),
      });
      imageIds.push(clearance);
    }
    // Separate kinds keep the same interaction layers at each map level.
    for (const kind of ["area", "pref"])
      addLayer({
        id: `card-count-names-${kind}`,
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
      id: "card-count-values",
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
  for (const [status, color] of Object.entries(palette.pins)) {
    const id = `card-square-${status}`;
    if (!map.hasImage(id)) {
      map.addImage(id, square(color, status, palette.pinRim), {
        pixelRatio: 2,
      });
      imageIds.push(id);
    }
  }
  if (import.meta.env.VITE_ACCOUNTS_ENABLED === "true")
    for (const state of ["all", "some"]) {
      const id = `card-receipt-${state}`;
      if (!map.hasImage(id)) {
        map.addImage(id, receiptBadge(state === "some"), { pixelRatio: 2 });
        imageIds.push(id);
      }
    }
  for (const source of [SOURCE, SELECTED]) {
    const selected = source === SELECTED;
    if (selected) {
      addLayer({
        id: "card-selection-outer",
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
        id: "card-selection-ring",
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
      filter: [
        "all",
        ["!", ["has", "point_count"]],
        ["==", ["get", "kind"], "lid"],
      ],
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
      filter: [
        "all",
        ["!", ["has", "point_count"]],
        ["==", ["get", "kind"], "place"],
      ],
      layout: {
        "icon-image": ["concat", "card-square-", ["get", "status"]],
        "icon-size": selected ? 1.25 : 1,
        "icon-allow-overlap": true,
        "icon-ignore-placement": true,
      },
      paint: { "icon-opacity": 1 },
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
    id: "card-current-halo",
    type: "circle",
    source: CURRENT,
    paint: {
      "circle-radius": 16,
      "circle-color": palette.iron,
      "circle-opacity": 0.15,
    },
  });
  addLayer({
    id: "card-current-location",
    type: "circle",
    source: CURRENT,
    paint: {
      "circle-radius": 8,
      "circle-color": palette.selection,
      "circle-stroke-width": 3,
      "circle-stroke-color": "#ffffff",
    },
  });
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
  paint("card-count-inner", "circle-stroke-color", p.inner);
  paint("card-count-values", "text-color", p.onIron);
  for (const kind of ["area", "pref"]) {
    paint(`card-count-names-${kind}`, "text-color", p.ink);
    paint(`card-count-names-${kind}`, "text-halo-color", p.paper);
  }
  paint("card-selection-ring", "circle-stroke-color", p.selection);
  paint("card-current-halo", "circle-color", p.iron);
  paint("card-current-location", "circle-color", p.selection);
  for (const [status, color] of Object.entries(p.pins))
    if (map.hasImage(`card-square-${status}`))
      map.updateImage(`card-square-${status}`, square(color, status, p.pinRim));
}
