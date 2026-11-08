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
function square(color: string) {
  const width = 24,
    data = new Uint8Array(width * width * 4);
  for (let y = 2; y < 22; y++)
    for (let x = 2; x < 22; x++) {
      const offset = (y * width + x) * 4;
      const border = x < 4 || y < 4 || x > 19 || y > 19;
      data[offset] = border ? 255 : parseInt(color.slice(1, 3), 16);
      data[offset + 1] = border ? 255 : parseInt(color.slice(3, 5), 16);
      data[offset + 2] = border ? 255 : parseInt(color.slice(5, 7), 16);
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
      "circle-color": "#174b49",
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
          "text-color": "#174b49",
          "text-halo-color": "#ffffff",
          "text-halo-width": 2,
        },
      });
  }
  for (const [status, color] of Object.entries(colors)) {
    const id = `card-square-${status}`;
    if (!map.hasImage(id)) {
      map.addImage(id, square(color));
      imageIds.push(id);
    }
  }
  for (const source of [SOURCE, SELECTED]) {
    const selected = source === SELECTED;
    if (selected)
      addLayer({
        id: "card-selection-ring",
        type: "circle",
        source,
        paint: {
          "circle-radius": 17,
          "circle-color": "#ffffff",
          "circle-stroke-width": 3,
          "circle-stroke-color": "#e38c16",
        },
      });
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
        "icon-size": selected ? 1.1 : 0.65,
        "icon-allow-overlap": true,
        "icon-ignore-placement": true,
      },
      paint: { "icon-opacity": ["case", ["get", "reference"], 0.7, 1] },
    });
  }
  addLayer({
    id: "card-current-location",
    type: "circle",
    source: CURRENT,
    paint: {
      "circle-radius": 8,
      "circle-color": "#2563eb",
      "circle-stroke-width": 3,
      "circle-stroke-color": "#ffffff",
    },
  });
}
