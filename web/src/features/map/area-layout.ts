import type { Bounds } from "../../prefectures";
type AreaPosition = { lng: number; lat: number; anchor: "left" | "right" };

// Display anchors only: never change a region's navigation bounds or pin data.
// left/right are MapLibre text anchors: left places the name to the right.
export const AREA_LAYOUT: Readonly<Record<string, AreaPosition>> = {
  hokkaido: { lng: 142.5, lat: 43.5, anchor: "right" },
  tohoku: { lng: 140.64, lat: 39.36, anchor: "right" },
  kanto: { lng: 140.94, lat: 35.3, anchor: "right" },
  chubu: { lng: 137.49, lat: 36.87, anchor: "left" },
  kinki: { lng: 136.6, lat: 33.7, anchor: "left" },
  chugoku: { lng: 133.22, lat: 36.17, anchor: "right" },
  shikoku: { lng: 133.29, lat: 31.93, anchor: "left" },
  kyushu: { lng: 129.75, lat: 33.92, anchor: "left" },
  okinawa: { lng: 128.2, lat: 26.5, anchor: "left" },
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
