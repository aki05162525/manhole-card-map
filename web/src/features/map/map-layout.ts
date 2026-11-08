import { paddingForSelection } from "./selection-padding";
import { floatingDetail } from "./map-dismiss";

export function selectionPadding(container: HTMLElement, count = 0) {
  const bounds = container.getBoundingClientRect();
  const root = container.closest(".explorer");
  const header = root
    ?.querySelector(".map-search-bar")
    ?.getBoundingClientRect();
  const notices = root?.querySelector(".map-notices")?.getBoundingClientRect();
  const headerBottom = Math.max(
    header?.bottom ?? bounds.top,
    notices?.bottom ?? bounds.top,
  );
  const detailElement = root?.querySelector<HTMLElement>(".detail-panel");
  const detail =
    detailElement && !floatingDetail(bounds.width, bounds.height)
      ? detailElement.getBoundingClientRect()
      : undefined;
  const actions = root?.querySelector(".map-actions")?.getBoundingClientRect();
  const locate = root?.querySelector("#locate")?.getBoundingClientRect();
  return paddingForSelection({
    bounds,
    headerBottom,
    // A collapsed sheet keeps its full height and slides off-screen.
    sheetHeight: detailElement?.classList.contains("is-collapsed")
      ? (detailElement.querySelector<HTMLElement>(".detail-actions")
          ?.offsetHeight ?? 0)
      : (detailElement?.offsetHeight ?? 0),
    detail,
    actions,
    locate,
    count,
  });
}

/** The national camera clears badges at all four edges as well as UI overlays. */
export function nationalPadding(container: HTMLElement) {
  const padding = selectionPadding(container);
  return {
    left: Math.max(48, padding.left),
    right: Math.max(48, padding.right),
    top: Math.max(48, padding.top),
    bottom: Math.max(48, padding.bottom),
  };
}
