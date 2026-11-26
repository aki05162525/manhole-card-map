import { floatingDetail } from "./screen-shape";

export function mapDismissAction(width: number, height: number) {
  return floatingDetail(width, height) ? "collapse" : "close";
}
export function dismissOnGesture(
  width: number,
  height: number,
  event: { type?: string; fromApp?: boolean; originalEvent?: unknown },
) {
  return (
    event.type === "zoomstart" &&
    floatingDetail(width, height) &&
    !event.fromApp &&
    !!event.originalEvent
  );
}
