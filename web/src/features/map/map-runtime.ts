import type {
  GeoJSONSource,
  MapMouseEvent,
  ErrorEvent,
  Map as MapLibreMap,
} from "maplibre-gl";
import type { Point } from "geojson";
import type { CardMapProps } from "./card-map";
import type { Adapter } from "./types";
import type { Pin } from "../../domain/types";
import { painted } from "../../shared/browser/painted";
import { dismissOnGesture } from "./map-dismiss";
import { selectionPadding } from "./map-layout";
import {
  SOURCE,
  SELECTED,
  COUNTS,
  CURRENT,
  PIN_LID,
  PIN_PLACE,
  POINTS,
  installMapResources,
} from "./map-resources";
import {
  emphasizePrefectureBorders,
  installBorderLayers,
  loadBorderData,
  BORDER_SOURCE,
  LOW_BORDER_LAYER,
  BORDER_LAYERS,
  featureCardIds,
  pinsGeoJSON,
} from "./mapcn-data";
import borderUrl from "../../pref-borders.json?url";
import {
  REGION_MAX_ZOOM,
  PIN_MIN_ZOOM,
  focusAfterZoomOut,
  focusCamera,
  focusChanged,
  countsGeoJSON,
  countPins,
  pinFilter,
  focusForAreaTap,
  focusForPrefTap,
  type MapFocus,
} from "./map-levels";
const duration = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 450;

function levelKeyFor(zoom: number, focus: MapFocus) {
  return JSON.stringify([
    zoom < REGION_MAX_ZOOM ? 0 : zoom < PIN_MIN_ZOOM ? 1 : 2,
    focus,
  ]);
}
export function createMapRuntime(
  map: MapLibreMap,
  readProps: () => CardMapProps,
) {
  const callbacks = {
    get current() {
      return readProps();
    },
  };
  let disposed = false;
  let started = false;
  let reported = false;
  let currentAdapter: Adapter | null = null;
  let cleanup: (() => void) | undefined;
  let sync: ((props: CardMapProps) => void) | undefined;
  const error = (event: ErrorEvent) => {
    if (!disposed && !reported) callbacks.current.onError(String(event.error));
    reported = true;
  };
  map.on("error", error);
  function initialize() {
    if (disposed || started) return;
    started = true;
    let countSource = callbacks.current.countPinsSource;
    let counts = countPins(countSource);
    let initialized = false;
    const layers: string[] = [];
    const imageIds: string[] = [];
    const restoreBorders = emphasizePrefectureBorders(map);
    let updateBorders: ((focus: MapFocus) => void) | undefined;
    installMapResources(map, callbacks.current, counts, layers, imageIds);
    let focus = callbacks.current.focus;
    let levelKey = "";
    let renderedCounts = counts;
    let renderedKey = levelKeyFor(map.getZoom(), focus);
    const applyLevel = () => {
      const zoom = map.getZoom();
      const key = levelKeyFor(zoom, focus);
      if (key === levelKey && renderedCounts === counts) return;
      levelKey = key;
      updateBorders?.(focus);
      if (renderedKey !== key || renderedCounts !== counts) {
        (map.getSource(COUNTS) as GeoJSONSource).setData(
          countsGeoJSON(zoom, focus, counts),
        );
        renderedKey = key;
        renderedCounts = counts;
      }
      map.setFilter(PIN_PLACE, pinFilter(zoom, focus, "place"));
      map.setFilter(PIN_LID, pinFilter(zoom, focus, "lid"));
      for (const property of [
        "circle-opacity",
        "circle-stroke-opacity",
      ] as const) {
        map.setPaintProperty(
          PIN_LID,
          property,
          zoom >= 7 && focus.pref
            ? ["case", ["==", ["get", "pref"], focus.pref], 1, 0.35]
            : 1,
        );
      }
      map.setPaintProperty(
        PIN_PLACE,
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
          padding: selectionPadding(map.getContainer(), pins.length),
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
      if (!features.length) {
        callbacks.current.onDismiss?.();
        return;
      }
      // queryRenderedFeatures returns topmost features first; keep that order on ties.
      let nearest = features[0];
      let nearestDistance = Infinity;
      for (const feature of features) {
        const point = map.project(
          (feature.geometry as Point).coordinates as [number, number],
        );
        const distance = (point.x - x) ** 2 + (point.y - y) ** 2;
        if (distance < nearestDistance) {
          nearest = feature;
          nearestDistance = distance;
        }
      }
      callbacks.current.onSelect(
        featureCardIds(nearest),
        nearest.properties.id,
      );
    };
    const hover = (event: MapMouseEvent) => {
      map.getCanvas().style.cursor = map.queryRenderedFeatures(event.point, {
        layers: [...POINTS, COUNTS],
      }).length
        ? "pointer"
        : "";
    };
    const gesture = (event: {
      type?: string;
      fromApp?: boolean;
      originalEvent?: unknown;
    }) => {
      const { width, height } = map.getContainer().getBoundingClientRect();
      if (dismissOnGesture(width, height, event))
        callbacks.current.onDismiss?.();
    };
    map.on("zoomstart", gesture);
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
        (map.getSource(CURRENT) as GeoJSONSource).setData({
          type: "Feature",
          properties: {},
          geometry: { type: "Point", coordinates: [lng, lat] },
        });
        map.easeTo(
          { center: [lng, lat], zoom: 14, duration: duration() },
          appMove,
        );
      },
      view: () => ({
        lat: map.getCenter().lat,
        lng: map.getCenter().lng,
        zoom: map.getZoom(),
      }),
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
    currentAdapter = adapter;
    const ready = () => {
      if (initialized || disposed || !map.isSourceLoaded(SOURCE)) return;
      initialized = true;
      // Panels overlay the map, so the first national view is measured here.
      // A selection made before the map was ready owns the camera; so does a
      // focus, which the first adapter.focus cannot move because it is unchanged.
      const initial = callbacks.current;
      if (!initial.selectedPins.length) {
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
      // Start after onReady so this optional asset never gates metrics.ready.
      void painted().then(() => {
        if (disposed) return;
        return loadBorderData(borderUrl, (data) => {
          if (disposed) return;
          updateBorders = installBorderLayers(map, data);
          layers.push(...BORDER_LAYERS);
          updateBorders(focus);
        });
      });
    };
    map.on("idle", ready);
    let previous: CardMapProps | undefined;
    sync = (props) => {
      if (disposed) return;
      if (!previous || previous.pins !== props.pins)
        (map.getSource(SOURCE) as GeoJSONSource).setData(
          pinsGeoJSON(props.pins),
        );
      if (!previous || previous.selectedPins !== props.selectedPins)
        adapter.select(props.selectedPins);
      if (countSource !== props.countPinsSource) {
        countSource = props.countPinsSource;
        counts = countPins(countSource);
      }
      if (!previous || previous.focus !== props.focus)
        adapter.focus(props.focus);
      applyLevel();
      previous = props;
    };

    cleanup = () => {
      map.off("zoom", applyLevel);
      map.off("zoom", zoomOut);
      map.off("idle", ready);
      map.off("zoomstart", gesture);
      map.off("click", click);
      map.off("mousemove", hover);
      restoreBorders?.();
      for (const id of [...layers, LOW_BORDER_LAYER].reverse())
        if (map.getLayer(id)) map.removeLayer(id);
      for (const id of [SELECTED, SOURCE, COUNTS, CURRENT, BORDER_SOURCE])
        if (map.getSource(id)) map.removeSource(id);
      // mapcn's parent effect may remove the map before this child cleanup.
      if (map.getStyle())
        for (const id of imageIds) if (map.hasImage(id)) map.removeImage(id);
    };
  }
  return {
    get adapter() {
      return currentAdapter;
    },
    initialize,
    sync(props: CardMapProps) {
      sync?.(props);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      currentAdapter = null;
      map.off("error", error);
      cleanup?.();
    },
  };
}
