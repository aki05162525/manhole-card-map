import type { Bounds } from "../../prefectures";
type AreaPosition = { lng: number; lat: number; anchor: "left" | "right" };

// Display anchors only: never change a region's navigation bounds or pin data.
// left/right are MapLibre text anchors: left places the name to the right.
export const AREA_LAYOUT: Readonly<Record<string, AreaPosition>> = {
  hokkaido: { lng: 142.6, lat: 43.4, anchor: "left" },
  tohoku: { lng: 140.7, lat: 39.4, anchor: "left" },
  kanto: { lng: 139.5, lat: 35.9, anchor: "left" },
  chubu: { lng: 137.6, lat: 36.3, anchor: "right" },
  kinki: { lng: 135.85, lat: 34.75, anchor: "left" },
  chugoku: { lng: 133.4, lat: 35.15, anchor: "right" },
  shikoku: { lng: 133, lat: 33.55, anchor: "left" },
  kyushu: { lng: 131.2, lat: 33, anchor: "right" },
  okinawa: { lng: 128.05, lat: 26.5, anchor: "left" },
};
export const NATIONAL_BOUNDS: Bounds = [
  [127.5, 26],
  [146, 45.6],
];
export function nationalCameraPadding(headerBottom: number, width = Infinity) {
  const side = width < 600 ? 8 : 16;
  return { left: side, right: side, top: headerBottom + 8, bottom: 16 };
}
export function areaBadgeRadius(count: number) {
  const digits = String(Math.max(0, count)).length;
  return Math.min(
    26,
    Math.max(
      16,
      digits >= 3 ? 18 : 14,
      14 + 0.55 * Math.sqrt(Math.max(0, count)),
    ),
  );
}
