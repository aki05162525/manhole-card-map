"use client";

import {
  Component,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type {
  GeoJSONSource,
  MapMouseEvent,
  ErrorEvent,
  Map as MapLibreMap,
} from "maplibre-gl";
import type { Point } from "geojson";
import { Map, MapControls, useMap } from "./components/ui/map";
import { colors, type Adapter, type Pin, type View } from "./types";
import { clusterCardIds, featureCardIds, pinsGeoJSON } from "./mapcn-data";
import { transitionMap, type MapPhase } from "./mapcn-lifecycle";

export type CardMapProps = {
  pins: Pin[];
  selectedPins: Pin[];
  onSelect(ids: string[]): void;
  onReady(adapter: Adapter): void;
  onError(message: string): void;
  onWarning?(message: string): void;
  initialView: View | null;
};
const SOURCE = "card-pins";
const SELECTED = "card-selected";
const CLUSTER = "card-clusters";
const POINTS = [
  "card-pins-lid",
  "card-pins-place",
  "card-selected-lid",
  "card-selected-place",
];
const duration = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 450;
const styleUrl =
  import.meta.env.MODE === "fixture"
    ? "/map-style.json"
    : import.meta.env.VITE_MAP_STYLE_URL;

class MapBoundary extends Component<
  { children: ReactNode; onError(message: string): void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error) {
    this.props.onError(String(error));
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

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

function selectionPadding(container: HTMLElement) {
  const width = container.clientWidth,
    height = container.clientHeight;
  // These match the floating panels; clamp pairs to leave at least 100px of map.
  const mobile = width <= 1000;
  const horizontal = mobile
    ? { left: 25, right: 65 }
    : { left: 400, right: 450 };
  const vertical = mobile
    ? { top: 240, bottom: height * 0.48 + 45 }
    : { top: 105, bottom: 85 };
  const xScale = Math.min(
    1,
    Math.max(0, width - 100) / (horizontal.left + horizontal.right),
  );
  const yScale = Math.min(
    1,
    Math.max(0, height - 100) / (vertical.top + vertical.bottom),
  );
  return {
    left: horizontal.left * xScale,
    right: horizontal.right * xScale,
    top: vertical.top * yScale,
    bottom: vertical.bottom * yScale,
  };
}

function MapLayers(props: CardMapProps) {
  const { map, isLoaded } = useMap();
  const callbacks = useRef(props);
  callbacks.current = props;
  const data = useMemo(() => pinsGeoJSON(props.pins), [props.pins]);
  const adapterRef = useRef<Adapter | null>(null);
  // Register errors before the style has loaded; an invalid URL must not hang silently.
  useEffect(() => {
    if (!map) return;
    let reported = false;
    const error = (event: ErrorEvent) => {
      if (!reported) callbacks.current.onError(String(event.error));
      reported = true;
    };
    map.on("error", error);
    return () => {
      map.off("error", error);
    };
  }, [map]);
  useEffect(() => {
    if (!map || !isLoaded) return;
    let disposed = false,
      initialized = false;
    const layers: string[] = [];
    const imageIds: string[] = [];
    const moveListeners = new Set<() => void>();
    const addLayer = (layer: Parameters<MapLibreMap["addLayer"]>[0]) => {
      map.addLayer(layer);
      layers.push(layer.id);
    };
    map.addSource(SOURCE, {
      type: "geojson",
      data,
      cluster: true,
      clusterRadius: 45,
      clusterMaxZoom: 18,
    });
    map.addSource(SELECTED, {
      type: "geojson",
      data: pinsGeoJSON(callbacks.current.selectedPins),
    });
    map.addSource("card-current", { type: "geojson", data: pinsGeoJSON([]) });
    addLayer({
      id: CLUSTER,
      type: "circle",
      source: SOURCE,
      filter: ["has", "point_count"],
      paint: {
        "circle-color": "#174b49",
        "circle-radius": ["step", ["get", "point_count"], 18, 20, 23, 100, 28],
        "circle-stroke-width": 2,
        "circle-stroke-color": "#ffffff",
      },
    });
    // A glyph-free fixture exercises geometry without any remote fonts.
    if (map.getStyle().glyphs)
      addLayer({
        id: "card-counts",
        type: "symbol",
        source: SOURCE,
        filter: ["has", "point_count"],
        layout: {
          "text-field": ["get", "point_count_abbreviated"],
          "text-font": ["Open Sans Regular"],
          "text-size": 12,
        },
        paint: { "text-color": "#ffffff" },
      });
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
          "circle-radius": selected ? 10 : 8,
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
          "icon-size": selected ? 1.1 : 1,
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,
        },
        paint: { "icon-opacity": ["case", ["get", "reference"], 0.7, 1] },
      });
    }
    addLayer({
      id: "card-current-location",
      type: "circle",
      source: "card-current",
      paint: {
        "circle-radius": 8,
        "circle-color": "#2563eb",
        "circle-stroke-width": 3,
        "circle-stroke-color": "#ffffff",
      },
    });
    const source = map.getSource(SOURCE) as GeoJSONSource;
    const select = (pins: Pin[]) => {
      if (disposed) return;
      (map.getSource(SELECTED) as GeoJSONSource).setData(pinsGeoJSON(pins));
      if (!pins.length) return;
      const lngs = pins.map((p) => p.lng),
        lats = pins.map((p) => p.lat);
      // Keep the camera independent of the sheet layout, which never resizes the map.
      map.fitBounds(
        [
          [Math.min(...lngs), Math.min(...lats)],
          [Math.max(...lngs), Math.max(...lats)],
        ],
        {
          maxZoom: 15,
          padding: selectionPadding(map.getContainer()),
          duration: duration(),
        },
      );
    };
    const click = async (event: MapMouseEvent) => {
      try {
        const pointFeatures = map.queryRenderedFeatures(event.point, {
          layers: POINTS,
        });
        if (pointFeatures.length) {
          callbacks.current.onSelect([
            ...new Set(pointFeatures.flatMap(featureCardIds)),
          ]);
          return;
        }
        const feature = map.queryRenderedFeatures(event.point, {
          layers: [CLUSTER],
        })[0];
        if (!feature) return;
        const clusterId = Number(feature.properties.cluster_id);
        const zoom = await source.getClusterExpansionZoom(clusterId);
        if (disposed) return;
        if (map.getZoom() >= 17.5 || zoom > 18) {
          const ids = await clusterCardIds(
            source,
            clusterId,
            Number(feature.properties.point_count),
          );
          if (!disposed) callbacks.current.onSelect(ids);
        } else {
          map.easeTo({
            center: (feature.geometry as Point).coordinates as [number, number],
            zoom,
            duration: duration(),
          });
        }
      } catch (error) {
        if (!disposed) callbacks.current.onError(String(error));
      }
    };
    const hover = (event: MapMouseEvent) => {
      map.getCanvas().style.cursor = map.queryRenderedFeatures(event.point, {
        layers: [...POINTS, CLUSTER],
      }).length
        ? "pointer"
        : "";
    };
    map.on("click", click);
    map.on("mousemove", hover);
    const adapter: Adapter = {
      ready: Promise.resolve(),
      select,
      locate(lat, lng) {
        if (disposed) return;
        (map.getSource("card-current") as GeoJSONSource).setData({
          type: "Feature",
          properties: {},
          geometry: { type: "Point", coordinates: [lng, lat] },
        });
        map.easeTo({ center: [lng, lat], zoom: 14, duration: duration() });
      },
      japan() {
        if (!disposed)
          map.fitBounds(
            [
              [122, 20],
              [154, 46],
            ],
            { padding: 55, duration: duration() },
          );
      },
      view: () => ({
        lat: map.getCenter().lat,
        lng: map.getCenter().lng,
        zoom: map.getZoom(),
      }),
      onMove(fn) {
        moveListeners.add(fn);
        map.on("moveend", fn);
      },
      async exercise() {
        map.jumpTo({ center: [139.76, 35.68], zoom: 7 });
        for (let i = 0; i < 6 && !disposed; i++) {
          map.panBy([i % 2 ? 80 : -80, 30], { duration: duration() });
          await new Promise((r) => setTimeout(r, 500));
          if (disposed) break;
          map.zoomTo(i % 2 ? 7 : 8, { duration: duration() });
          await new Promise((r) => setTimeout(r, 500));
        }
      },
      tapPoint() {
        const canvas = map.getCanvas();
        const rect = canvas.getBoundingClientRect();
        for (const feature of map.queryRenderedFeatures({
          layers: [...POINTS, CLUSTER],
        })) {
          const point = map.project(
            (feature.geometry as Point).coordinates as [number, number],
          );
          // Measurement scripts add #map's rectangle. Skip points hidden by UI.
          if (
            document.elementFromPoint(
              point.x + rect.left,
              point.y + rect.top,
            ) === canvas
          ) {
            return { x: point.x, y: point.y };
          }
        }
        return null;
      },
    };
    adapterRef.current = adapter;
    const ready = () => {
      if (initialized || disposed || !map.isSourceLoaded(SOURCE)) return;
      initialized = true;
      callbacks.current.onReady(adapter);
    };
    map.on("idle", ready);
    return () => {
      disposed = true;
      adapterRef.current = null;
      map.off("idle", ready);
      map.off("click", click);
      map.off("mousemove", hover);
      moveListeners.forEach((fn) => map.off("moveend", fn));
      for (const id of layers.reverse())
        if (map.getLayer(id)) map.removeLayer(id);
      for (const id of [SELECTED, SOURCE, "card-current"])
        if (map.getSource(id)) map.removeSource(id);
      // mapcn's parent effect may remove the map before this child cleanup.
      if (map.getStyle())
        for (const id of imageIds) if (map.hasImage(id)) map.removeImage(id);
    };
  }, [map, isLoaded, data]);
  useEffect(() => {
    adapterRef.current?.select(props.selectedPins);
  }, [props.selectedPins, map, isLoaded]);
  return null;
}

export default function CardMap(props: CardMapProps) {
  const [failed, setFailed] = useState(false);
  const callbacks = useRef(props);
  callbacks.current = props;
  const phase = useRef<MapPhase>("loading");
  const reportError = (message: string, fatal = false) => {
    const next = transitionMap(phase.current, fatal ? "fatal" : "error");
    phase.current = next.state;
    if (next.notification === "error") {
      setFailed(true);
      callbacks.current.onError(message);
    } else if (next.notification === "warning") {
      callbacks.current.onWarning?.(message);
    }
  };
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (phase.current !== "loading") return;
      phase.current = "failed";
      setFailed(true);
      callbacks.current.onError("地図の読み込みが時間内に完了しませんでした。");
    }, 20000);
    return () => clearTimeout(timeout);
  }, []);
  if (failed) return null;
  const view = props.initialView;
  return (
    <MapBoundary onError={(message) => reportError(message, true)}>
      <Map
        theme="light"
        styles={styleUrl ? { light: styleUrl, dark: styleUrl } : undefined}
        center={view ? [view.lng, view.lat] : [138, 36]}
        zoom={view?.zoom ?? 4}
        maxZoom={18}
        minZoom={2}
        localIdeographFontFamily="sans-serif"
        attributionControl={{ compact: false }}
      >
        <MapLayers
          {...props}
          onError={reportError}
          onReady={(adapter) => {
            const next = transitionMap(phase.current, "ready");
            phase.current = next.state;
            if (next.notification === "ready")
              callbacks.current.onReady(adapter);
          }}
        />
        <MapControls position="bottom-right" className="card-map-controls" />
      </Map>
    </MapBoundary>
  );
}
