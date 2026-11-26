// The numbers of the sheet's motion that TypeScript needs as numbers, for its
// timers, inline transitions and measurements. tokens.css and detail-sheet.css
// declare the same values for the CSS; sheet-motion.test.ts holds them equal.

/** --sheet-open: the sheet opens, and a released drag runs at most this long. */
export const SHEET_OPEN_MS = 280;
/** --sheet-close: the sheet folds or closes. */
export const SHEET_CLOSE_MS = 200;
/** --sheet-open-easing, as cubic-bezier(x1, y1, x2, y2). */
export const SHEET_OPEN_EASING = [0.2, 0.8, 0.2, 1] as const;
export const SHEET_OPEN_CURVE = `cubic-bezier(${SHEET_OPEN_EASING.join(", ")})`;
/**
 * The summary takes up to `percent` of the screen, at least `least` px on a
 * short one, but never more than `mostPercent` of it or `most` px.
 */
export const SHEET_SUMMARY_LIMIT = {
  percent: 56,
  least: 352,
  mostPercent: 70,
  most: 440,
};
/** The room under the summary, above the action bar or the safe area. */
export const SHEET_SUMMARY_GAP = 16;

export function sheetSummaryLimit(screen: number) {
  const { percent, least, mostPercent, most } = SHEET_SUMMARY_LIMIT;
  return Math.min(
    Math.max((screen * percent) / 100, least),
    (screen * mostPercent) / 100,
    most,
  );
}
