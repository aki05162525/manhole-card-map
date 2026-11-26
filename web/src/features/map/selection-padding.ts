import { floatingDetail, narrowScreen } from "./screen-shape";
import { sheetPadding } from "./detail-sheet";
/** A map's size and what covers it, in px from its top-left corner. */
export type SelectionLayout = {
  width: number;
  height: number;
  /** The lowest bottom edge of the bar, the notices and the trail. */
  top: number;
  sheetHeight: number;
  /** The right edge of the panel beside the map, if one is open. */
  panel?: number | undefined;
  /** The top edge of the locate button. */
  locate?: number | undefined;
  count?: number;
};
export function paddingForSelection({
  width,
  height,
  top,
  sheetHeight,
  panel,
  locate,
  count = 0,
}: SelectionLayout) {
  const mobile = narrowScreen(width);
  const floating = floatingDetail(width, height);
  // Measure actual overlays: coverage notices and selected details change height.
  // The bottom edge already clears the map controls, so the sides stay narrow.
  const controlBottom = height - (locate ?? height - 40) + 20;
  const padding = floating
    ? {
        left: 24,
        right: 24,
        ...sheetPadding(height, top, sheetHeight, count),
      }
    : {
        // The detail is on the left; the map's controls are on the right.
        left: panel === undefined ? 24 : panel + 20,
        right: 65,
        top: top + 20,
        bottom: mobile ? controlBottom : 70,
      };
  // Very small landscape windows may not fit both panels. Keep valid bounds.
  const xScale = Math.min(
    1,
    Math.max(0, width - 40) / (padding.left + padding.right),
  );
  const yScale = Math.min(
    1,
    Math.max(0, height - 40) / (padding.top + padding.bottom),
  );
  return {
    left: padding.left * xScale,
    right: padding.right * xScale,
    top: padding.top * yScale,
    bottom: padding.bottom * yScale,
  };
}
