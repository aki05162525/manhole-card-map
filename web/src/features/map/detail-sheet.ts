export type SheetState = "collapsed" | "summary" | "full";
export type SheetAction = SheetState | "close" | "stay";
export type SheetAnchors = Record<SheetState, number>;
/** Project swipes onto measured stops; taps and small gestures advance one step. */
export function sheetAfterSwipe(
  state: SheetState,
  distance: number,
  velocity: number,
  anchors: SheetAnchors,
  top = sheetDragOffset(anchors[state], distance),
): SheetAction {
  const down =
    distance > 0 &&
    (distance >= (state === "collapsed" ? 40 : 80) || velocity >= 0.5);
  const step: SheetAction = down
    ? state === "full"
      ? "summary"
      : state === "summary"
        ? "collapsed"
        : "close"
    : "stay";
  const up = distance < 0 && (distance <= -40 || velocity <= -0.5);
  const minimum =
    up || (!down && Math.abs(distance) < 8)
      ? state === "collapsed"
        ? "summary"
        : state === "summary"
          ? "full"
          : "stay"
      : step;
  if (minimum === "close" || Math.abs(distance) < 24) return minimum;
  const limit = minimum === "stay" ? state : minimum;
  const projected = top + Math.max(-4, Math.min(4, velocity)) * 200;
  // The old one-step rule is a lower bound on travel in the gesture direction.
  // Closing is deliberately excluded from projection.
  const stops: SheetState[] = ["full", "summary", "collapsed"];
  const candidates = stops.filter((stop) =>
    distance > 0
      ? anchors[stop] >= anchors[limit]
      : anchors[stop] <= anchors[limit],
  );
  const nearest = candidates.reduce(
    (nearest, stop) =>
      Math.abs(anchors[stop] - projected) <
      Math.abs(anchors[nearest] - projected)
        ? stop
        : nearest,
    limit,
  );
  return nearest === state ? "stay" : nearest;
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
