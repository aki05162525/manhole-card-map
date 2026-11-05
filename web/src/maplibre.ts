import * as maplibregl from "maplibre-gl";
import { type GeoJSONSource, type LayerSpecification } from "maplibre-gl";
import { Protocol } from "pmtiles";
import { layers, namedFlavor } from "@protomaps/basemaps";
import "maplibre-gl/dist/maplibre-gl.css";
import { type Create, colors } from "./types";
import workerURL from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
maplibregl.setWorkerUrl(workerURL);
const protocol = new Protocol();
maplibregl.addProtocol("pmtiles", protocol.tile);
export const create: Create = (pins, onSelect, view) => {
  const map = new maplibregl.Map({
    container: "map",
    center: view ? [view.lng, view.lat] : [138, 33],
    zoom: view?.zoom ?? 3,
    maxZoom: 18,
    attributionControl: false,
    localIdeographFontFamily: "sans-serif",
    style: {
      version: 8,
      glyphs: location.origin + "/fonts/{fontstack}/{range}.pbf",
      sprite: location.origin + "/sprites/light",
      sources: {
        base: {
          type: "vector",
          url: "pmtiles://" + location.origin + "/maps/japan.pmtiles",
          attribution:
            '<a href="https://protomaps.com">Protomaps</a> © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a> / <a href="https://www.naturalearthdata.com/">Natural Earth</a> / <a href="https://esa-worldcover.org/">ESA WorldCover</a>',
        },
      },
      layers: layers("base", namedFlavor("light"), {
        lang: "ja",
      }) as LayerSpecification[],
    },
  });
  map.addControl(new maplibregl.AttributionControl({ compact: false }));
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }));
  const japan = () =>
    map.fitBounds(
      [
        [122, 20],
        [154, 46],
      ],
      { padding: 8, duration: 0 },
    );
  if (!view) japan();
  const geo = (ps: typeof pins): GeoJSON.FeatureCollection => ({
    type: "FeatureCollection",
    features: ps.map((p) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [p.lng, p.lat] },
      properties: {
        id: p.id,
        ids: JSON.stringify(p.cardIds),
        kind: p.kind,
        status: p.status,
        color: colors[p.status],
      },
    })),
  });
  let resolve!: () => void, reject!: (e: Error) => void;
  const ready = new Promise<void>((r, j) => {
    resolve = r;
    reject = j;
  });
  let failed = false;
  map.on("error", (e) => {
    failed = true;
    reject(new Error(String(e.error)));
  });
  map.on("load", () => {
    map.addSource("pins", {
      type: "geojson",
      data: geo(pins),
      cluster: true,
      clusterRadius: 45,
      clusterMaxZoom: 16,
    });
    map.addSource("selected", { type: "geojson", data: geo([]) });
    map.addLayer({
      id: "clusters",
      type: "circle",
      source: "pins",
      filter: ["has", "point_count"],
      paint: {
        "circle-color": "#174b49",
        "circle-radius": 17,
        "circle-stroke-width": 2,
        "circle-stroke-color": "white",
      },
    });
    map.addLayer({
      id: "counts",
      type: "symbol",
      source: "pins",
      filter: ["has", "point_count"],
      layout: {
        "text-field": ["get", "point_count_abbreviated"],
        "text-font": ["Noto Sans Regular"],
        "text-size": 12,
      },
      paint: { "text-color": "white" },
    });
    for (const source of ["pins", "selected"]) {
      map.addLayer({
        id: source + "-lid",
        type: "circle",
        source,
        filter: [
          "all",
          ["!", ["has", "point_count"]],
          ["==", ["get", "kind"], "lid"],
        ],
        paint: {
          "circle-color": ["get", "color"],
          "circle-radius": source === "selected" ? 11 : 8,
          "circle-stroke-width": source === "selected" ? 3 : 2,
          "circle-stroke-color": source === "selected" ? "#ffaa33" : "white",
        },
      });
      // 四角形の配布場所は画像を使わず、ローカルに生成したアイコンで区別する。
      for (const [status, color] of Object.entries(colors)) {
        const size = 24,
          bytes = new Uint8Array(size * size * 4);
        for (let y = 2; y < 22; y++)
          for (let x = 2; x < 22; x++) {
            const i = (y * size + x) * 4;
            const border = x < 4 || y < 4 || x > 19 || y > 19;
            bytes[i] = border ? 255 : parseInt(color.slice(1, 3), 16);
            bytes[i + 1] = border ? 255 : parseInt(color.slice(3, 5), 16);
            bytes[i + 2] = border ? 255 : parseInt(color.slice(5, 7), 16);
            bytes[i + 3] = 255;
          }
        if (!map.hasImage(status))
          map.addImage(status, { width: size, height: size, data: bytes });
      }
      map.addLayer({
        id: source + "-place",
        type: "symbol",
        source,
        filter: [
          "all",
          ["!", ["has", "point_count"]],
          ["==", ["get", "kind"], "place"],
        ],
        layout: {
          "icon-image": ["get", "status"],
          "icon-size": source === "selected" ? 1.3 : 1,
          "icon-allow-overlap": true,
        },
      });
      for (const kind of ["lid", "place"])
        map.on("click", source + "-" + kind, (e) => {
          if (e.features?.[0])
            onSelect(JSON.parse(e.features[0].properties.ids));
        });
    }
    map.on("click", "clusters", async (e) => {
      const f = e.features?.[0];
      if (!f) return;
      const z = await (
        map.getSource("pins") as GeoJSONSource
      ).getClusterExpansionZoom(f.properties.cluster_id);
      map.easeTo({
        center: (f.geometry as GeoJSON.Point).coordinates as [number, number],
        zoom: z,
      });
    });
    map.once("idle", () => {
      if (!failed && map.areTilesLoaded()) resolve();
    });
  });
  let current: maplibregl.Marker | undefined;
  return {
    ready,
    japan,
    view: () => ({
      lat: map.getCenter().lat,
      lng: map.getCenter().lng,
      zoom: map.getZoom(),
    }),
    onMove: (fn) => {
      map.on("moveend", fn);
    },
    select(ps) {
      map.resize();
      if (!map.getSource("selected")) return;
      (map.getSource("selected") as GeoJSONSource).setData(geo(ps));
      if (ps.length) {
        const b = new maplibregl.LngLatBounds();
        ps.forEach((p) => b.extend([p.lng, p.lat]));
        map.fitBounds(b, {
          maxZoom: 15,
          padding: 55,
          duration: 0,
        });
      }
    },
    locate(lat, lng) {
      current?.remove();
      const el = document.createElement("div");
      el.className = "current";
      current = new maplibregl.Marker({ element: el })
        .setLngLat([lng, lat])
        .addTo(map);
      map.jumpTo({ center: [lng, lat], zoom: 14 });
    },
    async exercise() {
      map.jumpTo({ center: [139.76, 35.68], zoom: 7 });
      await new Promise((r) => setTimeout(r, 1500));
      for (let i = 0; i < 6; i++) {
        map.panBy([i % 2 ? 80 : -80, 30], { duration: 300 });
        await new Promise((r) => setTimeout(r, 400));
        map.zoomTo(i % 2 ? 7 : 8, { duration: 300 });
        await new Promise((r) => setTimeout(r, 400));
      }
    },
    tapPoint() {
      const f = map.queryRenderedFeatures({
        layers: ["pins-lid", "pins-place"],
      })[0];
      if (!f) return null;
      const p = map.project(
        (f.geometry as GeoJSON.Point).coordinates as [number, number],
      );
      return { x: p.x, y: p.y };
    },
  };
};
