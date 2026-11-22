import type { Bounds } from "../../prefectures";

type Padding = { top: number; bottom: number; left: number; right: number };

/** Web Mercator's ordinate in degrees, as long as a degree of longitude. */
function mercator(lat: number) {
  return (
    (Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) * 180) / Math.PI
  );
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
      (512 * 2 ** level.maxZoom) / 360,
    ),
  );
  const centreX = left + (width - left - right) / 2;
  const centreY = top + (height - top - bottom) / 2;
  return {
    scale,
    zoom: Math.log2((scale * 360) / 512),
    x: (lng: number) => centreX + (lng - (west + east) / 2) * scale,
    y: (lat: number) => centreY - (mercator(lat) - (low + high) / 2) * scale,
  };
}
