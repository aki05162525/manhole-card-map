export type SheetState = "collapsed" | "summary" | "full";
export type SheetAction = SheetState | "close" | "stay";
/** Gestures advance exactly one step; a tap on the handle advances upward. */
export function sheetAfterSwipe(
  state: SheetState,
  distance: number,
  velocity: number,
): SheetAction {
  const down =
    distance > 0 &&
    (distance >= (state === "collapsed" ? 40 : 80) || velocity >= 0.5);
  if (down)
    return state === "full"
      ? "summary"
      : state === "summary"
        ? "collapsed"
        : "close";
  const up = distance < 0 && (distance <= -40 || velocity <= -0.5);
  if (up || Math.abs(distance) < 8)
    return state === "collapsed"
      ? "summary"
      : state === "summary"
        ? "full"
        : "stay";
  return "stay";
}
/** Padding centers a point in the remaining viewport. Multiple pins use all visible space. */
export function sheetPadding(
  height: number,
  headerBottom: number,
  sheetHeight: number,
  count: number,
) {
  const top = headerBottom + 20;
  const bottom = sheetHeight + 20;
  if (count !== 1) return { top, bottom };
  const target = Math.max(top, Math.min(height * 0.25, height - bottom));
  const difference = 2 * target - height;
  return difference >= 0
    ? { top: difference, bottom: 0 }
    : { top: 0, bottom: -difference };
}
export function sheetDragOffset(base: number, distance: number) {
  return Math.max(0, base + distance);
}
export function smoothedVelocity(
  previous: number,
  distance: number,
  elapsed: number,
) {
  return 0.4 * previous + (0.6 * distance) / Math.max(1, elapsed);
}
