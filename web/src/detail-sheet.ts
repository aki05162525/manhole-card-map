export function dismissSheet(distance: number, velocity: number) {
  return distance > 0 && (distance >= 80 || velocity >= 0.5);
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
