import { vi } from "vitest";
import type { LayerSpecification, Map as MapLibreMap } from "maplibre-gl";

/** A rendered feature as the runtime reads it: a point and its properties. */
export type FakeFeature = {
  type?: "Feature";
  geometry: { type: "Point"; coordinates: [number, number] };
  properties: Record<string, unknown>;
};
/** The raw RGBA images the map resources draw. */
type FakeImage = { width: number; height: number; data: Uint8Array };
type FakeEvent = { type: string } & Record<string, unknown>;
type Listener = (event: FakeEvent) => void;
type LayerType = LayerSpecification["type"];
type LayerOf<T extends LayerType> = Extract<LayerSpecification, { type: T }>;
type ScreenPoint = { x: number; y: number };
type ScreenBox = [[number, number], [number, number]];
type QueryOptions = { layers?: string[] };

const isType = <T extends LayerType>(
  layer: LayerSpecification | undefined,
  type: T,
): layer is LayerOf<T> => layer?.type === type;

/**
 * A MapLibre map with a loaded style, for the code in this directory.
 *
 * It keeps the style's state (sources, layers in order, images, listeners)
 * and implements only the methods that code calls. A method it lacks fails the
 * test as "not a function" instead of passing silently, so add it here.
 *
 * It refuses what MapLibre refuses (read from maplibre-gl 6.17): a change to a
 * layer or image the style does not have, a second layer or image of one name
 * and a query of a missing layer fire an `error` event; a second source of one
 * name throws, and the image and layer methods throw once the map is removed,
 * when it has no style.
 *
 * `basemap` is the provider's layers already in the style. A container without
 * a document (the node tests) has only its size. Longitude and latitude are
 * the screen's x and y, so a feature's coordinates say where it is drawn.
 */
export function fakeMapLibre({
  zoom: initialZoom = 4,
  width = 412,
  height = 823,
  glyphs = true,
  basemap = [] as LayerSpecification[],
} = {}) {
  const listeners = new Map<string, Set<Listener>>();
  const sources = new Map<string, { setData: ReturnType<typeof vi.fn> }>();
  const layers = new Map(basemap.map((layer) => [layer.id, layer]));
  const images = new Map<string, FakeImage>();
  const drawn: { layer: string; feature: FakeFeature; reach: number }[] = [];
  const errors: string[] = [];
  let size = { width, height };
  const rect = () => ({
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: size.width,
    bottom: size.height,
    ...size,
    toJSON: () => size,
  });
  const container =
    typeof document === "undefined"
      ? { getBoundingClientRect: rect }
      : Object.assign(document.createElement("div"), {
          getBoundingClientRect: rect,
        });
  let removed = false;
  let zoom = initialZoom;
  let fitZoom = 8;
  let sourcesLoaded = true;
  const emit = (name: string, event: Record<string, unknown> = {}) => {
    for (const fn of listeners.get(name) ?? []) fn({ type: name, ...event });
  };
  const refuse = (message: string) => {
    errors.push(message);
    emit("error", { error: Error(message) });
  };
  /** MapLibre reads `this.style`, which a removed map no longer has. */
  const styled = () => {
    if (removed) throw TypeError("the map has no style");
  };
  /** The layer to change, or an `error` event as MapLibre fires. */
  const existing = (id: string) => {
    const layer = layers.get(id);
    if (!layer) refuse(`non-existing layer "${id}"`);
    return layer;
  };
  const restyle = (
    id: string,
    part: "paint" | "layout",
    key: string,
    value: unknown,
  ) => {
    const layer = existing(id);
    if (layer)
      Object.assign(layer, { [part]: { ...layer[part], [key]: value } });
  };
  const map = {
    on: vi.fn((name: string, fn: Listener) => {
      if (!listeners.has(name)) listeners.set(name, new Set());
      listeners.get(name)!.add(fn);
    }),
    off: vi.fn((name: string, fn: Listener) => {
      listeners.get(name)?.delete(fn);
    }),
    addSource: vi.fn((id: string) => {
      if (sources.has(id)) throw Error("duplicate source");
      sources.set(id, { setData: vi.fn() });
    }),
    getSource: (id: string) => sources.get(id),
    removeSource: vi.fn((id: string) => {
      styled();
      if (!sources.has(id)) throw Error(`no source ${id}`);
      const user = [...layers.values()].find(
        (layer) => "source" in layer && layer.source === id,
      );
      if (user) refuse(`source "${id}" is used by layer "${user.id}"`);
      else sources.delete(id);
    }),
    addLayer: vi.fn((layer: LayerSpecification, before?: string) => {
      if (layers.has(layer.id)) {
        refuse(`Layer "${layer.id}" already exists on this map.`);
        return;
      }
      if (before === undefined) {
        layers.set(layer.id, layer);
        return;
      }
      if (!layers.has(before)) {
        refuse(`cannot add "${layer.id}" before non-existing "${before}"`);
        return;
      }
      const above = [...layers].slice([...layers.keys()].indexOf(before));
      for (const [id] of above) layers.delete(id);
      layers.set(layer.id, layer);
      for (const [id, upper] of above) layers.set(id, upper);
    }),
    getLayer: (id: string) => layers.get(id),
    removeLayer: vi.fn((id: string) => {
      styled();
      if (existing(id)) layers.delete(id);
    }),
    // To the top, as MapLibre does without a `beforeId`.
    moveLayer: vi.fn((id: string) => {
      styled();
      const layer = existing(id);
      if (!layer) return;
      layers.delete(id);
      layers.set(id, layer);
    }),
    getStyle: () =>
      removed
        ? undefined
        : {
            // MapLibre serializes the style: a copy, not the live layers.
            layers: structuredClone([...layers.values()]),
            ...(glyphs && { glyphs: "glyphs" }),
          },
    hasImage: (id: string) => {
      styled();
      return images.has(id);
    },
    addImage: vi.fn((id: string, image: FakeImage) => {
      styled();
      if (images.has(id)) refuse(`an image named "${id}" already exists`);
      else images.set(id, image);
    }),
    updateImage: vi.fn((id: string, image: FakeImage) => {
      styled();
      if (images.has(id)) images.set(id, image);
      else refuse(`the map has no image "${id}"`);
    }),
    removeImage: vi.fn((id: string) => {
      styled();
      if (!images.delete(id)) refuse(`an image named "${id}" does not exist`);
    }),
    setFilter: vi.fn((id: string, _filter: unknown) => {
      if (!removed) existing(id);
    }),
    setPaintProperty: vi.fn((id: string, key: string, value: unknown) => {
      if (!removed) restyle(id, "paint", key, value);
    }),
    setLayoutProperty: vi.fn((id: string, key: string, value: unknown) => {
      styled();
      restyle(id, "layout", key, value);
    }),
    setLayerZoomRange: vi.fn((id: string, minzoom: number, maxzoom: number) => {
      styled();
      const layer = existing(id);
      if (layer) Object.assign(layer, { minzoom, maxzoom });
    }),
    getZoom: () => zoom,
    setMinZoom: vi.fn((_zoom: number) => {}),
    setTransformConstrain: vi.fn(),
    getContainer: () => container,
    cameraForBounds: (_bounds: unknown) => ({ zoom: fitZoom }),
    fitBounds: vi.fn(),
    easeTo: vi.fn(),
    jumpTo: vi.fn(),
    panBy: vi.fn(),
    zoomTo: vi.fn(),
    project: ([x, y]: [number, number]) => ({ x, y }),
    getCenter: () => ({ lat: 35, lng: 139 }),
    getCanvas: () => container,
    /**
     * What `draw` put under a point or in a box, on the layers asked for: the
     * top layer's first, as MapLibre returns them by descending z-order.
     */
    queryRenderedFeatures: vi.fn(
      (
        first?: ScreenPoint | ScreenBox | QueryOptions,
        second?: QueryOptions,
      ): FakeFeature[] => {
        const geometry =
          first && (Array.isArray(first) || "x" in first) ? first : undefined;
        const asked =
          first && !Array.isArray(first) && !("x" in first)
            ? first.layers
            : second?.layers;
        const missing = asked?.find((id) => !layers.has(id));
        if (missing !== undefined) {
          refuse(`the layer '${missing}' cannot be queried for features`);
          return [];
        }
        const order = [...layers.keys()];
        return drawn
          .filter(({ layer, feature, reach }) => {
            if (!layers.has(layer)) return false;
            if (asked && !asked.includes(layer)) return false;
            if (!geometry) return true;
            const [x, y] = feature.geometry.coordinates;
            if (!Array.isArray(geometry))
              return Math.hypot(geometry.x - x, geometry.y - y) <= reach;
            const [[left, top], [right, bottom]] = geometry;
            return (
              x >= left - reach &&
              x <= right + reach &&
              y >= top - reach &&
              y <= bottom + reach
            );
          })
          .sort((a, b) => order.indexOf(b.layer) - order.indexOf(a.layer))
          .map(({ feature }) => feature);
      },
    ),
    isSourceLoaded: () => sourcesLoaded,
    stop: vi.fn(),
    resize: vi.fn(),
    triggerRepaint: vi.fn(),
  };
  return {
    /** The spies, to assert what the code under test called. */
    map,
    /**
     * The same object, given to the code under test as a MapLibre map. The
     * one place a fake stands in for MapLibre's type; see above for its limits.
     */
    maplibre: map as unknown as MapLibreMap,
    sources,
    listeners,
    /** The style's layers, bottom first. */
    layers,
    images,
    /** What the map refused, each also fired as an `error` event. */
    errors,
    /** The layer `id`, which must exist and be of `type`. */
    layer<T extends LayerType>(type: T, id: string): LayerOf<T> {
      const layer = layers.get(id);
      if (!isType(layer, type)) throw Error(`no ${type} layer ${id}`);
      return layer;
    },
    emit,
    /**
     * Draws features on a layer of the style, the topmost of that layer first.
     * A query hits one within `reach` pixels of its point: a circle's radius or
     * half a label's width.
     */
    draw(layer: string, features: FakeFeature[], reach = 0) {
      drawn.push(...features.map((feature) => ({ layer, feature, reach })));
    },
    setZoom(value: number) {
      zoom = value;
    },
    /** The zoom at which any bounds fit the viewport (8 until set). */
    setFitZoom(value: number) {
      fitZoom = value;
    },
    /** Whether the sources' data has reached the map (it has until set). */
    setSourcesLoaded(value: boolean) {
      sourcesLoaded = value;
    },
    setSize(nextWidth: number, nextHeight: number) {
      size = { width: nextWidth, height: nextHeight };
    },
    remove() {
      removed = true;
      sources.clear();
      layers.clear();
      images.clear();
    },
  };
}
