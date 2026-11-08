import type { Map as MapLibreMap, ExpressionSpecification } from "maplibre-gl";
import { colors } from "./types";
import { pinsGeoJSON } from "./mapcn-data";
import { countsGeoJSON, type countPins } from "./map-levels";
import type { CardMapProps } from "./card-map";
export const SOURCE = "card-pins";
export const SELECTED = "card-selected";
export const CURRENT = "card-current";
export const PIN_LID = `${SOURCE}-lid`;
export const PIN_PLACE = `${SOURCE}-place`;
export const COUNTS = "card-level-counts";
export const POINTS = [
  PIN_LID,
  PIN_PLACE,
  "card-selected-lid",
  "card-selected-place",
];
// 20 CSS pixels: a 16px state symbol with a 2px white halo, sampled at 2x.
function square(color: string, status: string) {
  const width = 40,
    data = new Uint8Array(width * width * 4);
  for (let y = 0; y < width; y++)
    for (let x = 0; x < width; x++) {
      const offset = (y * width + x) * 4;
      const sx = Math.floor(x / 2) - 2,
        sy = Math.floor(y / 2) - 2;
      const halo = sx < 0 || sy < 0 || sx >= 16 || sy >= 16;
      const border = sx < 2 || sy < 2 || sx >= 14 || sy >= 14;
      const reference = status === "reference";
      if (
        !halo &&
        reference &&
        border &&
        ((sx >= 6 && sx < 10) || (sy >= 6 && sy < 10))
      )
        continue;
      const hollow = status === "ended" || status === "unknown" || reference;
      const white =
        halo || (!border && (hollow || (status === "suspended" && sx >= 8)));
      data[offset] = white ? 255 : parseInt(color.slice(1, 3), 16);
      data[offset + 1] = white ? 255 : parseInt(color.slice(3, 5), 16);
      data[offset + 2] = white ? 255 : parseInt(color.slice(5, 7), 16);
      data[offset + 3] = 255;
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

// Camera expressions must keep interpolate(zoom) at the property root.
function countRadius(inset = 0, divisor = 1): ExpressionSpecification {
  const radius = (scale: number): ExpressionSpecification => [
    "max",
    0,
    ["/", ["-", ["*", ["get", "radius"], scale], inset], divisor],
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
) {
  const addLayer = (layer: Parameters<MapLibreMap["addLayer"]>[0]) => {
    map.addLayer(layer);
    layers.push(layer.id);
  };
  map.addSource(SOURCE, {
    type: "geojson",
    data: pinsGeoJSON(props.pins),
  });
  map.addSource(SELECTED, {
    type: "geojson",
    data: pinsGeoJSON(props.selectedPins),
  });
  map.addSource(CURRENT, { type: "geojson", data: pinsGeoJSON([]) });
  map.addSource(COUNTS, {
    type: "geojson",
    data: countsGeoJSON(map.getZoom(), props.focus, counts),
  });
  addLayer({
    id: COUNTS,
    type: "circle",
    source: COUNTS,
    paint: {
      "circle-radius": countRadius(),
      "circle-color": "#1d2321",
      "circle-stroke-width": 2,
      "circle-stroke-color": "#f3f1ec",
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
      "circle-stroke-color": "rgba(255,255,255,0.5)",
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
          "text-field": [
            "concat",
            ["get", "name"],
            " ",
            ["to-string", ["get", "count"]],
            "か所",
          ],
          "text-font": ["Open Sans Regular"],
          "text-size": 12,
          "text-variable-anchor": ["top", "bottom", "right", "left"],
          "text-radial-offset": 2.5,
          "text-optional": true,
          "text-allow-overlap": false,
        },
        paint: {
          "text-color": "#1d2321",
          "text-halo-color": "#f3f1ec",
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
        "text-font": ["Open Sans Semibold"],
        "text-size": 13,
        "text-allow-overlap": true,
      },
      paint: { "text-color": "#ffffff" },
    });
  }
  for (const [status, color] of Object.entries({
    ...colors,
    reference: "#5f625e",
  })) {
    const id = `card-square-${status}`;
    if (!map.hasImage(id)) {
      map.addImage(id, square(color, status), { pixelRatio: 2 });
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
          "circle-stroke-color": "#1d2321",
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
        "icon-image": [
          "case",
          ["get", "reference"],
          "card-square-reference",
          ["concat", "card-square-", ["get", "status"]],
        ],
        "icon-size": selected ? 1.25 : 1,
        "icon-allow-overlap": true,
        "icon-ignore-placement": true,
      },
      paint: { "icon-opacity": 1 },
    });
  }
  addLayer({
    id: "card-current-halo",
    type: "circle",
    source: CURRENT,
    paint: {
      "circle-radius": 16,
      "circle-color": "#1d2321",
      "circle-opacity": 0.15,
    },
  });
  addLayer({
    id: "card-current-location",
    type: "circle",
    source: CURRENT,
    paint: {
      "circle-radius": 8,
      "circle-color": "#1d2321",
      "circle-stroke-width": 3,
      "circle-stroke-color": "#ffffff",
    },
  });
}
