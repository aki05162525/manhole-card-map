import type { Bounds } from "../../prefectures";
type AreaPosition = { lng: number; lat: number; anchor: "left" | "right" };

// Display anchors only: never change a region's navigation bounds or pin data.
// left/right are MapLibre text anchors: left places the name to the right.
export const AREA_LAYOUT: Readonly<Record<string, AreaPosition>> = {
  hokkaido: { lng: 142.5, lat: 43.5, anchor: "right" },
  tohoku: { lng: 140.64, lat: 39.36, anchor: "left" },
  kanto: { lng: 140.2, lat: 35.6, anchor: "left" },
  chubu: { lng: 137.8, lat: 36.8, anchor: "right" },
  kinki: { lng: 135.9, lat: 34.85, anchor: "left" },
  chugoku: { lng: 133.2, lat: 35.2, anchor: "right" },
  shikoku: { lng: 133.2, lat: 33.35, anchor: "left" },
  kyushu: { lng: 130.6, lat: 32.5, anchor: "right" },
  okinawa: { lng: 128.1, lat: 26.6, anchor: "left" },
};
export const NATIONAL_BOUNDS: Bounds = [
  [127.5, 26],
  [146, 45.6],
];
export function nationalCameraPadding(headerBottom: number) {
  return { left: 16, right: 16, top: headerBottom + 8, bottom: 16 };
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
