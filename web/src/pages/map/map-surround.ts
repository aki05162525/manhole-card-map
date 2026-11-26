import type { MapSurround } from "../../features/map/map-layout";

/**
 * How much of the sheet shows. A collapsed sheet keeps its full height and
 * slides off-screen, all but the peek that use-explorer-layout measured.
 */
function sheetHeight(detail: HTMLElement | null | undefined) {
  return detail?.classList.contains("is-collapsed")
    ? parseFloat(detail.style.getPropertyValue("--sheet-peek-height")) ||
        (detail.querySelector<HTMLElement>(".detail-actions")?.offsetHeight ??
          0)
    : parseFloat(
        detail?.style.getPropertyValue("--sheet-summary-height") || "",
      ) ||
        detail?.offsetHeight ||
        0;
}

/**
 * The map page's panels over its map: the search bar (a friend's header
 * too), the notices, the trail of levels, the detail and the locate button.
 */
export const mapSurround: MapSurround = {
  cover(map, bounds) {
    const root = map.closest(".explorer");
    const rect = (selector: string) =>
      root?.querySelector(selector)?.getBoundingClientRect();
    const bottom = (selector: string) => {
      const found = rect(selector);
      return found && found.bottom - bounds.top;
    };
    const bar = bottom(".map-search-bar");
    const notices = bottom(".map-notices") ?? 0;
    const trail = bottom(".map-actions") ?? 0;
    const detail = root?.querySelector<HTMLElement>(".detail-panel");
    const panel = detail?.getBoundingClientRect();
    const locate = rect("#locate");
    return {
      bar,
      notices,
      trail,
      panel: panel && panel.right - bounds.left,
      sheet: sheetHeight(detail),
      locate: locate && locate.top - bounds.top,
    };
  },
  // The row beside the search bar, and the notices in it.
  watched(map) {
    const row = map.closest(".explorer")?.querySelector(".map-top");
    const notices = row?.querySelector(".map-notices");
    return [row, notices].filter((element) => !!element);
  },
  // A chosen region adds the trail to that row. On a phone the row has no
  // box of its own, so the trail itself is watched from the commit that adds it.
  watchedForLevel(map) {
    const trail = map.closest(".explorer")?.querySelector(".map-actions");
    return trail ? [trail] : [];
  },
};
