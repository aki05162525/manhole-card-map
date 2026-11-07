export function floatingDetail(width: number, height: number) {
  return width <= 1000 && !(height <= 540 && width >= 600);
}
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
