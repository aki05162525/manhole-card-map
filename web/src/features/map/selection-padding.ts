import { floatingDetail } from "./map-dismiss";
import { sheetPadding } from "./detail-sheet";
type Rect = {
  top: number;
  bottom: number;
  left: number;
  right: number;
  width: number;
  height: number;
};
export type SelectionLayout = {
  bounds: Rect;
  headerBottom: number;
  sheetHeight: number;
  detail?: Rect | undefined;
  actions?: Rect | undefined;
  locate?: Rect | undefined;
  count?: number;
};
export function paddingForSelection({
  bounds,
  headerBottom,
  sheetHeight,
  detail,
  actions,
  locate,
  count = 0,
}: SelectionLayout) {
  const { width, height } = bounds;
  const mobile = width <= 1000;
  const floating = floatingDetail(width, height);
  // Measure actual overlays: coverage notices and selected details change height.
  // The bottom edge already clears the map controls, so the sides stay narrow.
  const controlBottom =
    bounds.bottom -
    Math.min(
      actions?.top ?? bounds.bottom - 40,
      locate?.top ?? bounds.bottom - 40,
    ) +
    20;
  const padding = floating
    ? {
        left: 24,
        right: 24,
        ...sheetPadding(height, headerBottom - bounds.top, sheetHeight, count),
      }
    : {
        // Short landscape screens put the detail on the left; desktop on the right.
        left: mobile && detail ? detail.right - bounds.left + 20 : 24,
        right: !mobile && detail ? bounds.right - detail.left + 20 : 65,
        top:
          Math.max(headerBottom, mobile ? 0 : (actions?.bottom ?? 0)) -
          bounds.top +
          20,
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
