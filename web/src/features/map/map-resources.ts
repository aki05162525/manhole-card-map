import type { Map as MapLibreMap } from "maplibre-gl";
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
function square(color: string, status: string) {
  const width = 16,
    data = new Uint8Array(width * width * 4);
  for (let y = 0; y < width; y++)
    for (let x = 0; x < width; x++) {
      const offset = (y * width + x) * 4;
      const border = x < 2 || y < 2 || x >= 14 || y >= 14;
      const reference = status === "reference";
      if (reference && border && ((x >= 6 && x < 10) || (y >= 6 && y < 10)))
        continue;
      const hollow = status === "ended" || status === "unknown" || reference;
      const white = !border && (hollow || (status === "suspended" && x >= 8));
      data[offset] = white ? 255 : parseInt(color.slice(1, 3), 16);
      data[offset + 1] = white ? 255 : parseInt(color.slice(3, 5), 16);
      data[offset + 2] = white ? 255 : parseInt(color.slice(5, 7), 16);
      data[offset + 3] = 255;
    }
  return { width, height: width, data };
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
      "circle-radius": 15,
      "circle-color": "#1d2321",
      "circle-stroke-width": 2,
      "circle-stroke-color": "#ffffff",
    },
  });
  if (map.getStyle().glyphs) {
    addLayer({
      id: "card-count-values",
      type: "symbol",
      source: COUNTS,
      layout: {
        "text-field": ["to-string", ["get", "count"]],
        "text-font": ["Open Sans Regular"],
        "text-size": 12,
        "text-allow-overlap": true,
      },
      paint: { "text-color": "#ffffff" },
    });
    // text-allow-overlap has no data expressions: split so only area names always show.
    for (const kind of ["area", "pref"])
      addLayer({
        id: `card-count-names-${kind}`,
        type: "symbol",
        source: COUNTS,
        filter: ["==", ["get", "kind"], kind],
        layout: {
          "text-field": ["get", "name"],
          "text-font": ["Open Sans Regular"],
          "text-size": 12,
          "text-offset": [0, 2],
          "text-optional": true,
          "text-allow-overlap": kind === "area",
        },
        paint: {
          "text-color": "#1d2321",
          "text-halo-color": "#ffffff",
          "text-halo-width": 2,
        },
      });
  }
  for (const [status, color] of Object.entries({
    ...colors,
    reference: "#5f625e",
  })) {
    const id = `card-square-${status}`;
    if (!map.hasImage(id)) {
      map.addImage(id, square(color, status));
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
        "icon-size": 1,
        "icon-allow-overlap": true,
        "icon-ignore-placement": true,
      },
      paint: { "icon-opacity": 1 },
    });
  }
  addLayer({
    id: "card-current-location",
    type: "circle",
    source: CURRENT,
    paint: {
      "circle-radius": 8,
      "circle-color": "#2e6f62",
      "circle-stroke-width": 3,
      "circle-stroke-color": "#ffffff",
    },
  });
}
