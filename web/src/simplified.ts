import L from "leaflet";
import { firstCanvasDraw } from "./canvas-ready";
import type { FeatureCollection } from "geojson";
import { leafletCreate } from "./leaflet-common";
import { groupBackgroundShapes } from "./background-shapes";

// Approximate label anchors, not geocoded facilities or selectable card pins.
const labels: [string, number, number][] = [
  ["札幌", 43.06, 141.35],
  ["仙台", 38.27, 140.87],
  ["東京", 35.68, 139.76],
  ["新潟", 37.92, 139.04],
  ["名古屋", 35.18, 136.91],
  ["大阪", 34.69, 135.5],
  ["広島", 34.39, 132.46],
  ["高松", 34.34, 134.05],
  ["福岡", 33.59, 130.4],
  ["鹿児島", 31.6, 130.56],
  ["那覇", 26.21, 127.68],
];

export const create = leafletCreate(8, async (map) => {
  map.attributionControl.addAttribution(
    '<a href="https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-N03-2026.html">国土数値情報（行政区域）2026年</a>を加工 / 概略図',
  );
  const response = await fetch("/background/japan.geojson");
  if (!response.ok)
    throw new Error(`簡略背景の読み込みに失敗: ${response.status}`);
  const data = (await response.json()) as FeatureCollection;
  if (
    data?.type !== "FeatureCollection" ||
    !Array.isArray(data.features) ||
    !data.features.length ||
    data.features.some(
      (f) =>
        !f.geometry || !["Polygon", "MultiPolygon"].includes(f.geometry.type),
    )
  )
    throw new Error("簡略背景の形式が不正");
  // Observe the actual first Canvas redraw, then shared ready awaits paint.
  const renderer = L.canvas({ padding: 0.2 });
  if (!renderer) throw new Error("Canvas背景を利用できません");
  const drawn = firstCanvasDraw(renderer as L.Canvas & { _redraw(): void });
  const options: L.GeoJSONOptions & L.PolylineOptions = {
    renderer,
    interactive: false,
    smoothFactor: 0,
    style: {
      color: "#8d998e",
      weight: 0.7,
      fillColor: "#e7eddf",
      fillOpacity: 1,
    },
  };
  L.geoJSON(groupBackgroundShapes(data), options).addTo(map);
  for (const [name, lat, lng] of labels) {
    L.marker([lat, lng], {
      interactive: false,
      keyboard: false,
      icon: L.divIcon({
        className: "background-label",
        html: `<span style="font-size:11px;white-space:nowrap;color:#435047;text-shadow:0 0 3px white,0 0 3px white">${name}</span>`,
        iconSize: [40, 16],
      }),
      zIndexOffset: -1000,
    }).addTo(map);
  }
  await drawn;
});
