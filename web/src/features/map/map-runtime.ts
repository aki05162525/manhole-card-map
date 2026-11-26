import { bindMapInteractions } from "./map-interactions";
import { yieldGlyphDrawing } from "./glyph-turns";
import { constrainToJapan, japanMinZoom } from "./japan-limits";
import { mapPalette, systemDark, watchMapTheme } from "./map-theme";
import { basemapRepaint } from "./basemap-style";
import type {
  ExpressionSpecification,
  GeoJSONSource,
  ErrorEvent,
  Map as MapLibreMap,
} from "maplibre-gl";
import type { GeoJSON } from "geojson";
import type { CardMapProps } from "./card-map";
import type { Adapter } from "./types";
import type { Pin } from "../../domain/types";
import type { Bounds } from "../../prefectures";
import { painted } from "../../shared/browser/painted";
import {
  levelCamera,
  mapFrame,
  nationalPadding,
  selectionPadding,
} from "./map-layout";
import {
  SOURCE,
  SELECTED,
  COUNTS,
  CURRENT,
  PIN_LID,
  PIN_PLACE,
  PIN_RECEIPT,
  POINTS,
  createMapResources,
  installMapResources,
  repaintMapResources,
  animateSelectionRing,
} from "./map-resources";
import {
  emphasizePrefectureBorders,
  installBorderLayers,
  loadBorderData,
  BORDER_SOURCE,
  LOW_BORDER_LAYER,
  BORDER_LAYERS,
  pinsGeoJSON,
} from "./mapcn-data";
import borderUrl from "../../pref-borders.json?url";
import {
  REGION_MAX_ZOOM,
  PIN_MIN_ZOOM,
  focusAfterZoomOut,
  focusChanged,
  countPins,
  countsForMap,
  pinFilter,
  type MapFocus,
} from "./map-levels";
import { diagnosticsEnabled } from "../../shared/browser/explorer-metrics";

const diagnostics = diagnosticsEnabled()
  ? await import("./map-diagnostics")
  : undefined;
const duration = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 450;

function levelKeyFor(zoom: number, focus: MapFocus) {
  return JSON.stringify([
    zoom < REGION_MAX_ZOOM ? 0 : zoom < PIN_MIN_ZOOM ? 1 : 2,
    focus,
  ]);
}
// The runtime adds these sources itself (map-resources), all as GeoJSON; the
// type argument names that, and a missing source (after removal) is skipped.
function setSourceData(map: MapLibreMap, id: string, data: GeoJSON) {
  void map.getSource<GeoJSONSource>(id)?.setData(data);
}
/** The text of a map's error: an Error as its usual `Error: message`. */
export function mapErrorText(error: { message: string }) {
  return error instanceof Error ? String(error) : error.message;
}
// Distinguish application camera moves from hand zooms that can close a level.
const appMove = { fromApp: true };
function trackLevelZoom(
  map: MapLibreMap,
  readProps: () => CardMapProps,
  getFocus: () => MapFocus,
  onZoomOut: (next: MapFocus) => void,
) {
  let lastZoom = map.getZoom();
  // The scale a level opened at, which a hand zoom-out must clearly pass to
  // close it. A level reached without its own fit (a hand zoom-out, or a
  // selection that owned the camera) is measured on its first zoom-out.
  let openedKey = "";
  let openedZoom = Infinity;
  const openedKeyFor = (level: MapFocus) =>
    JSON.stringify([level.area, level.pref]);
  const fitLevel = (
    level: MapFocus,
    bounds: Bounds,
    options: Omit<ReturnType<typeof levelCamera>, "bounds">,
    duration: number,
  ) => {
    openedKey = openedKeyFor(level);
    openedZoom = map.cameraForBounds(bounds, options)?.zoom ?? Infinity;
    map.fitBounds(bounds, { ...options, duration }, appMove);
  };
  const zoomOut = (event: { type: string; fromApp?: boolean }) => {
    const focus = getFocus();
    const zoom = map.getZoom();
    const shrinking = zoom < lastZoom;
    lastZoom = zoom;
    if (event.fromApp || !shrinking || !focus.area) return;
    const key = openedKeyFor(focus);
    if (key !== openedKey) {
      openedKey = key;
      const { bounds, ...options } = levelCamera(
        mapFrame(map.getContainer(), readProps().surround),
        focus,
        readProps().countPinsSource,
      );
      openedZoom = map.cameraForBounds(bounds, options)?.zoom ?? Infinity;
    }
    const next = focusAfterZoomOut(zoom, focus, openedZoom);
    if (next === focus) return;
    onZoomOut({ ...next, preserveCamera: true });
  };
  map.on("zoom", zoomOut);
  return {
    fitLevel,
    stop: () => {
      map.off("zoom", zoomOut);
    },
  };
}

/** The level a map was created over and the bounds it fitted then. */
export type MapOpening = { focus: MapFocus; bounds: Bounds };
export function createMapRuntime(
  map: MapLibreMap,
  readProps: () => CardMapProps,
  opening?: () => MapOpening | null,
) {
  const callbacks = {
    get current() {
      return readProps();
    },
  };
  let disposed = false;
  // Behind another screen: a late call (a position, a timer) moves nothing.
  let hidden = false;
  let started = false;
  let reported = false;
  let currentAdapter: Adapter | null = null;
  const cleanup: Array<() => void> = [];
  let sync: ((props: CardMapProps) => void) | undefined;
  // What the page lays over the map now, as the page measures it.
  const frame = () => mapFrame(map.getContainer(), callbacks.current.surround);
  const error = (event: ErrorEvent) => {
    if (!disposed && !reported)
      callbacks.current.onError(mapErrorText(event.error));
    reported = true;
  };
  map.on("error", error);
  // Again whenever the style changes: a restored WebGL context builds a new
  // style, and with it a glyph manager that draws all at once.
  const glyphsInTurns = () => yieldGlyphDrawing(map);
  map.on("styledata", glyphsInTurns);
  glyphsInTurns();
  function initialize() {
    if (disposed || started) return;
    started = true;
    let countSource = callbacks.current.countPinsSource;
    let counts = countPins(countSource);
    let initialized = false;
    let dark = systemDark();
    const resources = createMapResources(map);
    cleanup.push(resources.remove);
    const restoreBorders = emphasizePrefectureBorders(map, dark);
    let updateBorders: ((focus: MapFocus) => void) | undefined;
    if (restoreBorders) {
      cleanup.push(restoreBorders);
      resources.own({ layers: [LOW_BORDER_LAYER], sources: [] });
    }
    installMapResources(map, callbacks.current, counts, dark, resources);
    // The repaint restores the provider's paint where the style keeps it, the
    // border emphasized above included. The app's own lines are painted after
    // it; the provider's pale copy below the pin zoom keeps the repaint's.
    const basemap = basemapRepaint(map);
    const repaint = () => {
      basemap(dark);
      for (const id of ["boundary_state", ...BORDER_LAYERS])
        if (map.getLayer(id))
          map.setPaintProperty(id, "line-color", mapPalette(dark).boundary);
    };
    // The OS may have changed while the source style was still loading.
    repaint();
    let focus = callbacks.current.focus;
    let levelKey = "";
    let renderedCounts = counts;
    const countKey = () =>
      levelKeyFor(map.getZoom(), focus) +
      (map.getContainer().getBoundingClientRect().width < 600
        ? ":compact"
        : ":full");
    let renderedKey = countKey();
    const applyLevel = () => {
      const zoom = map.getZoom();
      const key = countKey();
      if (key === levelKey && renderedCounts === counts) return;
      levelKey = key;
      updateBorders?.(focus);
      if (renderedKey !== key || renderedCounts !== counts) {
        setSourceData(
          map,
          COUNTS,
          countsForMap(
            zoom,
            focus,
            counts,
            map.getContainer().getBoundingClientRect().width,
          ),
        );
        renderedKey = key;
        renderedCounts = counts;
      }
      map.setFilter(PIN_PLACE, pinFilter(zoom, focus, "place"));
      map.setFilter(PIN_LID, pinFilter(zoom, focus, "lid"));
      if (import.meta.env.VITE_ACCOUNTS_ENABLED === "true")
        map.setFilter(PIN_RECEIPT, [
          "all",
          pinFilter(zoom, focus, "place"),
          ["in", ["get", "receipt"], ["literal", ["all", "some"]]],
        ]);
      // With a prefecture open, the pins of the others step back.
      const opacity: ExpressionSpecification | number =
        zoom >= PIN_MIN_ZOOM && focus.pref
          ? [
              "case",
              ["==", ["get", "pref"], focus.pref],
              1,
              mapPalette(dark).inactivePinOpacity,
            ]
          : 1;
      map.setPaintProperty(PIN_LID, "circle-opacity", opacity);
      map.setPaintProperty(PIN_LID, "circle-stroke-opacity", opacity);
      map.setPaintProperty(PIN_PLACE, "icon-opacity", opacity);
      if (import.meta.env.VITE_ACCOUNTS_ENABLED === "true")
        map.setPaintProperty(PIN_RECEIPT, "icon-opacity", opacity);
    };
    map.on("zoom", applyLevel);
    cleanup.push(() => map.off("zoom", applyLevel));
    const { fitLevel, stop: stopLevelZoom } = trackLevelZoom(
      map,
      readProps,
      () => focus,
      (next) => {
        focus = next;
        applyLevel();
        callbacks.current.onFocus(focus);
      },
    );
    cleanup.push(stopLevelZoom);
    // Japan only: the centre stays over its islands and the view never shrinks
    // far past the national one.
    const limitToJapan = () => {
      const { width, height } = map.getContainer().getBoundingClientRect();
      if (width && height)
        map.setMinZoom(japanMinZoom(width, height, nationalPadding(frame())));
    };
    limitToJapan();
    map.setTransformConstrain(constrainToJapan(map));
    map.on("resize", limitToJapan);
    cleanup.push(() => map.off("resize", limitToJapan));
    map.on("resize", applyLevel);
    cleanup.push(() => map.off("resize", applyLevel));
    applyLevel();
    let cancelRingAnimation = () => {};
    cleanup.push(() => cancelRingAnimation());
    const select = (pins: Pin[]) => {
      if (disposed || hidden) return;
      setSourceData(map, SELECTED, pinsGeoJSON(pins, dark));
      cancelRingAnimation();
      if (!pins.length) return;
      cancelRingAnimation = animateSelectionRing(map, duration() === 0);
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
          padding: selectionPadding(frame(), pins.length),
          duration: duration(),
        },
        appMove,
      );
    };
    cleanup.push(bindMapInteractions(map, readProps, () => focus));
    const adapter: Adapter = {
      select,
      focus(next) {
        if (disposed || hidden) return;
        if (!focusChanged(focus, next)) return;
        focus = next;
        applyLevel();
        if (next.preserveCamera) return;
        const { bounds, ...options } = levelCamera(
          frame(),
          next,
          callbacks.current.countPinsSource,
        );
        // Until the map is handed over nobody watches the move.
        fitLevel(next, bounds, options, initialized ? duration() : 0);
      },
      locate(lat, lng) {
        if (disposed || hidden) return;
        setSourceData(map, CURRENT, {
          type: "Feature",
          properties: {},
          geometry: { type: "Point", coordinates: [lng, lat] },
        });
        map.easeTo(
          { center: [lng, lat], zoom: 14, duration: duration() },
          appMove,
        );
      },
      diagnostics: diagnostics?.mapDiagnostics(map, () => disposed, duration),
    };
    currentAdapter = adapter;
    // The map is handed over once what its level shows can be pressed. The
    // counts wait for the whole view: until then the same choices are offered
    // in front of the map (level-stage.tsx), and the basemap appears whole.
    // A prefecture's pins, or a selection's, are what the user waits for:
    // they are handed over as soon as they are drawn and can be hit, while
    // the basemap's tiles still load behind them.
    const pinsDrawn = () => {
      const { focus, selectedPins } = callbacks.current;
      return (
        (focus.pref !== null || selectedPins.length > 0) &&
        map.queryRenderedFeatures({ layers: POINTS }).length > 0
      );
    };
    const ready = (event: { type: string }) => {
      if (initialized || disposed || !map.isSourceLoaded(SOURCE)) return;
      if (event.type !== "idle" && !pinsDrawn()) return;
      initialized = true;
      stopReady();
      // A selection made before the map was ready owns the camera; so does a
      // focus, which the first adapter.focus cannot move because it is unchanged.
      // The level the map opened over keeps the bounds it was drawn with, so
      // pins that arrived after the map was created do not move it; the padding
      // is measured again in case a panel changed meanwhile.
      const initial = callbacks.current;
      if (!initial.selectedPins.length) {
        const { bounds, ...options } = levelCamera(
          frame(),
          initial.focus,
          initial.countPinsSource,
        );
        const opened = opening?.();
        fitLevel(
          initial.focus,
          opened && !focusChanged(opened.focus, initial.focus)
            ? opened.bounds
            : bounds,
          options,
          0,
        );
      }
      callbacks.current.onReady(adapter);
      // Start after onReady so this optional asset never gates metrics.ready.
      void painted().then(() => {
        if (disposed) return;
        return loadBorderData(borderUrl, (data) => {
          if (disposed) return;
          updateBorders = installBorderLayers(map, data, dark);
          resources.own({
            layers: [...BORDER_LAYERS],
            sources: [BORDER_SOURCE],
          });
          updateBorders(focus);
        });
      });
    };
    const stopReady = () => {
      map.off("idle", ready);
      map.off("render", ready);
    };
    map.on("idle", ready);
    map.on("render", ready);
    cleanup.push(stopReady);
    let previous: CardMapProps | undefined;
    sync = (props) => {
      if (disposed) return;
      if (!previous || previous.pins !== props.pins)
        setSourceData(map, SOURCE, pinsGeoJSON(props.pins, dark));
      if (!previous || previous.selectedPins !== props.selectedPins) {
        if (
          import.meta.env.VITE_ACCOUNTS_ENABLED === "true" &&
          previous &&
          previous.selectedPins.length === props.selectedPins.length &&
          previous.selectedPins.every(
            (pin, index) => pin.id === props.selectedPins[index].id,
          )
        )
          setSourceData(map, SELECTED, pinsGeoJSON(props.selectedPins, dark));
        else adapter.select(props.selectedPins);
      }
      if (countSource !== props.countPinsSource) {
        countSource = props.countPinsSource;
        counts = countPins(countSource);
      }
      if (!previous || previous.focus !== props.focus)
        adapter.focus(props.focus);
      applyLevel();
      previous = props;
    };

    const stopTheme = watchMapTheme((next) => {
      if (next === dark) return;
      dark = next;
      repaint();
      repaintMapResources(map, dark);
      levelKey = "";
      applyLevel();
      setSourceData(map, SOURCE, pinsGeoJSON(callbacks.current.pins, dark));
      setSourceData(
        map,
        SELECTED,
        pinsGeoJSON(callbacks.current.selectedPins, dark),
      );
    });
    cleanup.push(stopTheme);
  }
  return {
    get adapter() {
      return currentAdapter;
    },
    initialize,
    sync(props: CardMapProps) {
      sync?.(props);
    },
    hide(value: boolean) {
      hidden = value;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      currentAdapter = null;
      map.off("error", error);
      map.off("styledata", glyphsInTurns);
      for (const release of cleanup.reverse()) release();
    },
  };
}
