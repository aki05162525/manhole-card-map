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
import {
  emphasizePrefectureBorders,
  featureCardIds,
  pinsGeoJSON,
} from "./mapcn-data";
import { transitionMap, type MapPhase } from "./mapcn-lifecycle";

import {
  focusAfterZoomOut,
  focusCamera,
  focusChanged,
  JAPAN,
  countsGeoJSON,
  countPins,
  pinFilter,
  tapAction,
  focusForAreaTap,
  focusForPrefTap,
  type MapFocus,
} from "./map-levels";
export type CardMapProps = {
  focus: MapFocus;
  onFocus(focus: MapFocus): void;
  countPinsSource: Pin[];
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
const COUNTS = "card-level-counts";
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
  const bounds = container.getBoundingClientRect();
  const width = bounds.width,
    height = bounds.height;
  const root = container.closest(".explorer");
  const search = root?.querySelector(".search-panel")?.getBoundingClientRect();
  const detail = root?.querySelector(".detail-panel")?.getBoundingClientRect();
  const actions = root?.querySelector(".map-actions")?.getBoundingClientRect();
  const mobile = width <= 1000;
  const searchOpen = !search || !root?.querySelector(".search-panel.is-closed");
  // Measure actual overlays: coverage notices and selected details change height.
  // The bottom edge already clears the map controls, so the sides stay narrow.
  const padding = mobile
    ? {
        left: 24,
        right: 24,
        top: search ? search.bottom - bounds.top + 20 : 24,
        bottom:
          height -
          Math.min(
            detail?.top ?? bounds.bottom - 40,
            actions?.top ?? bounds.bottom - 40,
          ) +
          bounds.top +
          20,
      }
    : {
        left: search && searchOpen ? search.right - bounds.left + 20 : 24,
        right: detail ? bounds.right - detail.left + 20 : 65,
        top:
          Math.max(
            actions?.bottom ?? 0,
            searchOpen ? 0 : (search?.bottom ?? 0),
          ) -
          bounds.top +
          20,
        bottom: 70,
      };
  // Very small landscape windows may not fit both panels. Keep valid bounds.
  const xScale = Math.min(
    1,
    Math.max(0, width - 40) / (padding.left + padding.right),
  );
  const yScale = Math.min(
    1,
    Math.max(0, height - 40) / (padding.top + padding.bottom),
  );
  return {
    left: padding.left * xScale,
    right: padding.right * xScale,
    top: padding.top * yScale,
    bottom: padding.bottom * yScale,
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
    emphasizePrefectureBorders(map);
    const addLayer = (layer: Parameters<MapLibreMap["addLayer"]>[0]) => {
      map.addLayer(layer);
      layers.push(layer.id);
    };
    map.addSource(SOURCE, {
      type: "geojson",
      data: pinsGeoJSON(callbacks.current.pins),
    });
    map.addSource(SELECTED, {
      type: "geojson",
      data: pinsGeoJSON(callbacks.current.selectedPins),
    });
    map.addSource("card-current", { type: "geojson", data: pinsGeoJSON([]) });
    map.addSource(COUNTS, {
      type: "geojson",
      data: countsGeoJSON(
        map.getZoom(),
        callbacks.current.focus,
        countPins(callbacks.current.countPinsSource),
      ),
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
      source: "card-current",
      paint: {
        "circle-radius": 8,
        "circle-color": "#2563eb",
        "circle-stroke-width": 3,
        "circle-stroke-color": "#ffffff",
      },
    });
    let focus = callbacks.current.focus;
    let levelKey = "";
    const applyLevel = () => {
      const zoom = map.getZoom();
      const key = JSON.stringify([zoom < 5.6 ? 0 : zoom < 7 ? 1 : 2, focus]);
      if (key === levelKey) return;
      levelKey = key;
      (map.getSource(COUNTS) as GeoJSONSource).setData(
        countsGeoJSON(
          zoom,
          focus,
          countPins(callbacks.current.countPinsSource),
        ),
      );
      map.setFilter("card-pins-place", pinFilter(zoom, focus, "place"));
      map.setFilter("card-pins-lid", pinFilter(zoom, focus, "lid"));
      for (const property of [
        "circle-opacity",
        "circle-stroke-opacity",
      ] as const) {
        map.setPaintProperty(
          "card-pins-lid",
          property,
          zoom >= 7 && focus.pref
            ? ["case", ["==", ["get", "pref"], focus.pref], 1, 0.35]
            : 1,
        );
      }
      map.setPaintProperty(
        "card-pins-place",
        "icon-opacity",
        zoom >= 7 && focus.pref
          ? ["case", ["==", ["get", "pref"], focus.pref], 1, 0.35]
          : 1,
      );
    };
    map.on("zoom", applyLevel);
    // The app's own camera moves pass this, so only a hand zoom-out closes a level.
    const appMove = { fromApp: true };
    let lastZoom = map.getZoom();
    let openedKey = "";
    let openedZoom = Infinity;
    const zoomOut = (event: { type: string; fromApp?: boolean }) => {
      const zoom = map.getZoom();
      const shrinking = zoom < lastZoom;
      lastZoom = zoom;
      if (event.fromApp || !shrinking || !focus.area) return;
      const key = JSON.stringify([focus.area, focus.pref]);
      if (key !== openedKey) {
        openedKey = key;
        const { bounds, maxZoom } = focusCamera(
          focus,
          callbacks.current.countPinsSource,
        );
        openedZoom =
          map.cameraForBounds(bounds, {
            padding: selectionPadding(map.getContainer()),
            maxZoom,
          })?.zoom ?? Infinity;
      }
      const next = focusAfterZoomOut(zoom, focus, openedZoom);
      if (next === focus) return;
      focus = { ...next, preserveCamera: true };
      applyLevel();
      callbacks.current.onFocus(focus);
    };
    map.on("zoom", zoomOut);
    applyLevel();
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
        appMove,
      );
    };
    const click = (event: MapMouseEvent) => {
      const badge = map.queryRenderedFeatures(event.point, {
        layers: [COUNTS],
      })[0];
      if (badge) {
        callbacks.current.onFocus(
          badge.properties.kind === "area"
            ? focusForAreaTap(badge.properties.id)
            : focusForPrefTap(badge.properties.id),
        );
        return;
      }
      const { x, y } = event.point;
      const features = map.queryRenderedFeatures(
        [
          [x - 12, y - 12],
          [x + 12, y + 12],
        ],
        { layers: POINTS },
      );
      if (!features.length) return;
      const count = new Set(features.map((f) => f.properties.id)).size;
      if (tapAction(count, map.getZoom()) === "select")
        callbacks.current.onSelect([
          ...new Set(features.flatMap(featureCardIds)),
        ]);
      else
        map.easeTo({
          center: event.lngLat,
          zoom: map.getZoom() + 2,
          duration: duration(),
        });
    };
    const hover = (event: MapMouseEvent) => {
      map.getCanvas().style.cursor = map.queryRenderedFeatures(event.point, {
        layers: [...POINTS, COUNTS],
      }).length
        ? "pointer"
        : "";
    };
    map.on("click", click);
    map.on("mousemove", hover);
    const adapter: Adapter = {
      ready: Promise.resolve(),
      select,
      focus(next) {
        if (disposed) return;
        if (!focusChanged(focus, next)) return;
        focus = next;
        applyLevel();
        if (next.preserveCamera) return;
        const { bounds, maxZoom } = focusCamera(
          next,
          callbacks.current.countPinsSource,
        );
        map.fitBounds(
          bounds,
          {
            padding: selectionPadding(map.getContainer()),
            maxZoom,
            duration: duration(),
          },
          appMove,
        );
      },
      locate(lat, lng) {
        if (disposed) return;
        (map.getSource("card-current") as GeoJSONSource).setData({
          type: "Feature",
          properties: {},
          geometry: { type: "Point", coordinates: [lng, lat] },
        });
        map.easeTo(
          { center: [lng, lat], zoom: 14, duration: duration() },
          appMove,
        );
      },
      japan() {
        if (!disposed)
          map.fitBounds(
            JAPAN,
            {
              padding: selectionPadding(map.getContainer()),
              duration: duration(),
            },
            appMove,
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
      tapPoint(id?: string) {
        const canvas = map.getCanvas();
        const rect = canvas.getBoundingClientRect();
        for (const feature of map.queryRenderedFeatures({
          layers: [...POINTS, COUNTS],
        })) {
          if (id && feature.properties.id !== id) continue;
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
      // Panels overlay the map, so the first national view is measured here.
      // A selection made before the map was ready owns the camera; so does a
      // focus, which the first adapter.focus cannot move because it is unchanged.
      const initial = callbacks.current;
      if (
        !initial.selectedPins.length &&
        (initial.focus.area || !initial.initialView)
      ) {
        const { bounds, maxZoom } = focusCamera(
          initial.focus,
          initial.countPinsSource,
        );
        map.fitBounds(
          bounds,
          {
            padding: selectionPadding(map.getContainer()),
            maxZoom,
            duration: 0,
          },
          appMove,
        );
      }
      callbacks.current.onReady(adapter);
    };
    map.on("idle", ready);
    return () => {
      disposed = true;
      adapterRef.current = null;
      map.off("zoom", applyLevel);
      map.off("zoom", zoomOut);
      map.off("idle", ready);
      map.off("click", click);
      map.off("mousemove", hover);
      moveListeners.forEach((fn) => map.off("moveend", fn));
      for (const id of layers.reverse())
        if (map.getLayer(id)) map.removeLayer(id);
      for (const id of [SELECTED, SOURCE, COUNTS, "card-current"])
        if (map.getSource(id)) map.removeSource(id);
      // mapcn's parent effect may remove the map before this child cleanup.
      if (map.getStyle())
        for (const id of imageIds) if (map.hasImage(id)) map.removeImage(id);
    };
  }, [map, isLoaded]);
  useEffect(() => {
    if (!map || !isLoaded) return;
    (map.getSource(SOURCE) as GeoJSONSource | undefined)?.setData(data);
  }, [data, map, isLoaded]);
  useEffect(() => {
    adapterRef.current?.select(props.selectedPins);
  }, [props.selectedPins, map, isLoaded]);
  useEffect(() => {
    adapterRef.current?.focus(props.focus);
  }, [props.focus, map, isLoaded]);
  useEffect(() => {
    if (!map || !isLoaded) return;
    (map.getSource(COUNTS) as GeoJSONSource | undefined)?.setData(
      countsGeoJSON(
        map.getZoom(),
        props.focus,
        countPins(props.countPinsSource),
      ),
    );
  }, [props.countPinsSource, props.focus, map, isLoaded]);
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
        center={view ? [view.lng, view.lat] : [136.5, 36.5]}
        zoom={view?.zoom ?? 3.5}
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
