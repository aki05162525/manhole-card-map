export type SheetAction = "collapse" | "close" | "expand" | "stay";
/** A collapsed sheet is short, so it needs a shorter swipe than an open one. */
export function sheetAfterSwipe(
  collapsed: boolean,
  distance: number,
  velocity: number,
): SheetAction {
  const down =
    distance > 0 && (distance >= (collapsed ? 40 : 80) || velocity >= 0.5);
  if (!collapsed) return down ? "collapse" : "stay";
  if (down) return "close";
  const up = distance < 0 && (distance <= -40 || velocity <= -0.5);
  return up || Math.abs(distance) < 8 ? "expand" : "stay";
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
