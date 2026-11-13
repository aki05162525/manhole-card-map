import type { TransformConstrainFunction } from "maplibre-gl";
import { NATIONAL_BOUNDS } from "./area-layout";

/**
 * Where the map's centre may go: from Yonaguni and Okinotorishima to
 * Minamitorishima and Cape Soya, so every island stays reachable.
 */
const CENTER_BOUNDS = [
  [122, 20],
  [154, 46.5],
] as const;

export function clampToJapan(lng: number, lat: number): [number, number] {
  const [[w, s], [e, n]] = CENTER_BOUNDS;
  return [Math.min(e, Math.max(w, lng)), Math.min(n, Math.max(s, lat))];
}

const mercatorY = (lat: number) =>
  -Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) / (2 * Math.PI);

type Padding = { top: number; right: number; bottom: number; left: number };

/**
 * The zoom that fits the national view in this viewport, less `margin` levels:
 * a little room around Japan, never a view of most of the world.
 */
export function japanMinZoom(
  width: number,
  height: number,
  padding: Padding,
  margin = 0.5,
) {
  const [[w, s], [e, n]] = NATIONAL_BOUNDS;
  const x = (e - w) / 360;
  const y = mercatorY(s) - mercatorY(n);
  const fit = Math.min(
    (width - padding.left - padding.right) / (512 * x),
    (height - padding.top - padding.bottom) / (512 * y),
  );
  return Math.log2(Math.max(fit, Number.MIN_VALUE)) - margin;
}

/** Keeps the centre over Japan; zoom stays inside the map's own limits. */
export function constrainToJapan(map: {
  getMinZoom(): number;
  getMaxZoom(): number;
}): TransformConstrainFunction {
  return (lngLat, zoom) => {
    const center = lngLat.wrap();
    [center.lng, center.lat] = clampToJapan(center.lng, center.lat);
    return {
      center,
      zoom: Math.min(map.getMaxZoom(), Math.max(map.getMinZoom(), zoom)),
    };
  };
}
