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
 * `basemap` is the provider's layers already in the style. A container without
 * a document (the node tests) has only its size.
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
  const restyle = (
    id: string,
    part: "paint" | "layout",
    key: string,
    value: unknown,
  ) => {
    const layer = layers.get(id);
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
    removeSource: vi.fn((id: string) => sources.delete(id)),
    addLayer: vi.fn((layer: LayerSpecification) => {
      if (layers.has(layer.id)) throw Error("duplicate layer");
      layers.set(layer.id, layer);
    }),
    getLayer: (id: string) => layers.get(id),
    removeLayer: vi.fn((id: string) => layers.delete(id)),
    // To the top, as MapLibre does without a `beforeId`.
    moveLayer: vi.fn((id: string) => {
      const layer = layers.get(id);
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
    hasImage: (id: string) => images.has(id),
    addImage: vi.fn((id: string, image: FakeImage) => {
      images.set(id, image);
    }),
    updateImage: vi.fn((id: string, image: FakeImage) => {
      images.set(id, image);
    }),
    removeImage: vi.fn((id: string) => images.delete(id)),
    setFilter: vi.fn(),
    setPaintProperty: vi.fn((id: string, key: string, value: unknown) =>
      restyle(id, "paint", key, value),
    ),
    setLayoutProperty: vi.fn((id: string, key: string, value: unknown) =>
      restyle(id, "layout", key, value),
    ),
    setLayerZoomRange: vi.fn(),
    getZoom: () => zoom,
    setMinZoom: vi.fn((_zoom: number) => {}),
    setTransformConstrain: vi.fn(),
    getContainer: () => container,
    cameraForBounds: () => ({ zoom: 8 }),
    fitBounds: vi.fn(),
    easeTo: vi.fn(),
    project: ([x, y]: [number, number]) => ({ x, y }),
    getCenter: () => ({ lat: 35, lng: 139 }),
    getCanvas: () => container,
    queryRenderedFeatures: vi.fn((): FakeFeature[] => []),
    isSourceLoaded: () => true,
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
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the fake implements only the methods this directory calls.
    maplibre: map as unknown as MapLibreMap,
    sources,
    listeners,
    /** The style's layers, bottom first. */
    layers,
    images,
    /** The layer `id`, which must exist and be of `type`. */
    layer<T extends LayerType>(type: T, id: string): LayerOf<T> {
      const layer = layers.get(id);
      if (!isType(layer, type)) throw Error(`no ${type} layer ${id}`);
      return layer;
    },
    emit(name: string, event: Record<string, unknown> = {}) {
      for (const fn of listeners.get(name) ?? []) fn({ type: name, ...event });
    },
    setZoom(value: number) {
      zoom = value;
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
