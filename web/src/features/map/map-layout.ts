import { nationalCameraPadding } from "./area-layout";
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
      : parseFloat(
          detailElement?.style.getPropertyValue("--sheet-summary-height") || "",
        ) ||
        detailElement?.offsetHeight ||
        0,
    detail,
    actions,
    locate,
    count,
  });
}

/** Fit the national composition below the permanent search bar. */
export function nationalPadding(container: HTMLElement) {
  const bounds = container.getBoundingClientRect();
  const header = container
    .closest(".explorer")
    ?.querySelector(".map-search-bar")
    ?.getBoundingClientRect();
  return nationalCameraPadding(header ? header.bottom - bounds.top : 64);
}
