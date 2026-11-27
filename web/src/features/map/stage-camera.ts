import type { Bounds } from "../../prefectures";

type Padding = { top: number; bottom: number; left: number; right: number };

/**
 * A view as MapLibre holds it: the place at the container's centre and the
 * zoom of its 512px world. The drawings before the map engine are laid out
 * with it, and the map opens at it (`map-runtime.ts`), so that a pin is at
 * the same pixel on either side of the swap.
 */
export type StageView = { center: [number, number]; zoom: number };

/** Web Mercator's ordinate in degrees, as long as a degree of longitude. */
function mercator(lat: number) {
  return (
    (Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) * 180) / Math.PI
  );
}
function latitude(ordinate: number) {
  return (Math.atan(Math.exp((ordinate * Math.PI) / 180)) * 360) / Math.PI - 90;
}

/** The pixels of a degree of longitude at a zoom, and back. */
const scaleOf = (zoom: number) => (512 * 2 ** zoom) / 360;
const zoomOf = (scale: number) => Math.log2((scale * 360) / 512);

/**
 * Where a place is drawn in a container of this size, centred on `centre`
 * (its longitude, and its Mercator ordinate) at `scale` pixels a degree.
 */
function projection(
  scale: number,
  centreX: number,
  centreY: number,
  lng: number,
  ordinate: number,
) {
  return {
    scale,
    zoom: zoomOf(scale),
    x: (to: number) => centreX + (to - lng) * scale,
    y: (to: number) => centreY - (mercator(to) - ordinate) * scale,
    /** The place under a pixel. */
    lngAt: (x: number) => lng + (x - centreX) / scale,
    latAt: (y: number) => latitude(ordinate - (y - centreY) / scale),
  };
}

/**
 * Where MapLibre's `fitBounds` puts a level in a container of this size:
 * the bounds centred in what the padding leaves, no closer than `maxZoom`.
 * `scale` is the pixels of a degree of longitude.
 */
export function stageCamera(
  width: number,
  height: number,
  level: { bounds: Bounds; maxZoom: number; padding: Padding },
) {
  const [[west, south], [east, north]] = level.bounds;
  const { top, bottom, left, right } = level.padding;
  const low = mercator(south),
    high = mercator(north);
  // MapLibre's world is 512px wide at zoom 0.
  const scale = Math.max(
    0,
    Math.min(
      (width - left - right) / (east - west),
      (height - top - bottom) / (high - low),
      scaleOf(level.maxZoom),
    ),
  );
  return projection(
    scale,
    left + (width - left - right) / 2,
    top + (height - top - bottom) / 2,
    (west + east) / 2,
    (low + high) / 2,
  );
}

/** A view drawn in a container of this size, as MapLibre would draw it. */
export function viewCamera(width: number, height: number, view: StageView) {
  const [lng, lat] = view.center;
  return projection(
    scaleOf(view.zoom),
    width / 2,
    height / 2,
    lng,
    mercator(lat),
  );
}

/** The view `fitBounds` leaves a container of this size at. */
export function fitView(
  width: number,
  height: number,
  level: Parameters<typeof stageCamera>[2],
): StageView {
  const camera = stageCamera(width, height, level);
  return {
    center: [camera.lngAt(width / 2), camera.latAt(height / 2)],
    zoom: camera.zoom,
  };
}

/**
 * A view `factor` times closer, no closer than `maxZoom`, that keeps the
 * place under (x, y) where it is: the press that asked for it stays on it.
 */
export function closerView(
  width: number,
  height: number,
  view: StageView,
  at: { x: number; y: number },
  factor: number,
  maxZoom: number,
): StageView {
  const camera = viewCamera(width, height, view);
  const zoom = Math.min(maxZoom, view.zoom + Math.log2(factor));
  const scale = scaleOf(zoom);
  const lng = camera.lngAt(at.x);
  const ordinate = mercator(camera.latAt(at.y));
  return {
    center: [
      lng + (width / 2 - at.x) / scale,
      latitude(ordinate - (height / 2 - at.y) / scale),
    ],
    zoom,
  };
}

/**
 * The view a drawing shows once moved by a drag or a pinch: the place drawn
 * at `p` is drawn at `scale * p + (x, y)`, in the container's pixels.
 */
export function movedView(
  width: number,
  height: number,
  view: StageView,
  move: { scale: number; x: number; y: number },
): StageView {
  const camera = viewCamera(width, height, view);
  return {
    center: [
      camera.lngAt((width / 2 - move.x) / move.scale),
      camera.latAt((height / 2 - move.y) / move.scale),
    ],
    zoom: view.zoom + Math.log2(move.scale),
  };
}

/**
 * `move` held to the zooms from `min` to `max`: past a limit it scales only
 * as far as the limit, around the point it kept still, so what is under
 * the fingers or the pointer stays there.
 */
export function boundedMove(
  view: StageView,
  move: { scale: number; x: number; y: number },
  min: number,
  max: number,
) {
  const zoom = Math.min(max, Math.max(min, view.zoom + Math.log2(move.scale)));
  const scale = 2 ** (zoom - view.zoom);
  if (scale === move.scale || move.scale === 1) return { ...move, scale };
  // The point the move leaves where it was: p = scale * p + offset.
  const still = {
    x: move.x / (1 - move.scale),
    y: move.y / (1 - move.scale),
  };
  return { scale, x: still.x * (1 - scale), y: still.y * (1 - scale) };
}
