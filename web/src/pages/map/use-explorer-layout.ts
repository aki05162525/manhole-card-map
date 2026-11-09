import { useEffect, useLayoutEffect, type RefObject } from "react";
import type { SheetState } from "../../features/map/detail-sheet";
import { floatingDetail } from "../../features/map/map-dismiss";
export function useExplorerLayout(
  explorerRef: RefObject<HTMLElement | null>,
  detailRef: RefObject<HTMLElement | null>,
  selection: unknown,
  searching: boolean,
  state: SheetState,
  layoutFull = false,
  mobile = false,
) {
  useEffect(() => {
    const root = explorerRef.current;
    if (!root) return;
    const header = root.querySelector(".map-search-bar");
    const notices = root.querySelector(".map-notices");
    const measure = () => {
      const bottom = Math.max(
        header?.getBoundingClientRect().bottom ?? 0,
        notices?.getBoundingClientRect().bottom ?? 0,
      );
      root.style.setProperty(
        "--header-bottom",
        `${bottom - root.getBoundingClientRect().top}px`,
      );
    };
    const observer = new ResizeObserver(measure);
    if (header) observer.observe(header);
    if (notices) observer.observe(notices);
    measure();
    return () => observer.disconnect();
  }, [explorerRef]);
  useLayoutEffect(() => {
    const root = explorerRef.current;
    const detail = detailRef.current;
    if (!root) return;
    const actions = detail?.querySelector<HTMLElement>(".detail-actions");
    const footer = root.querySelector<HTMLElement>(".sheet-action-bar");
    const summary = detail?.querySelector<HTMLElement>(".sheet-summary");
    const measure = () => {
      if (detail?.matches(".is-dragging, [data-sheet-moving]")) return;
      if (!detail || !floatingDetail(root.clientWidth, root.clientHeight)) {
        root.style.setProperty("--detail-sheet-height", "0px");
        return;
      }
      const safeArea = parseFloat(getComputedStyle(detail).paddingBottom) || 0;
      const footerHeight = footer?.offsetHeight ?? 0;
      root.style.setProperty("--sheet-action-height", `${footerHeight}px`);
      let peek = actions?.offsetHeight ?? 0;
      let height =
        parseFloat(detail.style.getPropertyValue("--sheet-summary-height")) ||
        0;
      // Preserve the compact level throughout full view and motion. Recalculate
      // the shared summary only when it is resting in the summary state.
      if (state === "summary") {
        const levels = [
          "data-sheet-compact",
          "data-sheet-without-prelude",
          "data-sheet-single-title",
        ];
        levels.forEach((level) => detail.removeAttribute(level));
        const limit = Math.min(root.clientHeight * 0.56, 440);
        const readHeight = () => {
          peek = actions?.offsetHeight ?? 0;
          return summary
            ? peek + summary.offsetHeight + (footerHeight || safeArea) + 16
            : detail.offsetHeight;
        };
        height = readHeight();
        for (const level of levels) {
          if (!summary || height <= limit) break;
          detail.setAttribute(level, "");
          height = readHeight();
        }
        height = Math.min(limit || height, height);
      }
      detail.style.setProperty("--sheet-peek-height", `${peek}px`);
      detail.style.setProperty("--sheet-summary-height", `${height}px`);
      root.style.setProperty(
        "--detail-sheet-height",
        `${state === "collapsed" ? peek + safeArea : height}px`,
      );
    };
    measure();
    detail?.addEventListener("sheet-settled", measure);
    const observer = new ResizeObserver(measure);
    if (detail) observer.observe(detail);
    if (actions) observer.observe(actions);
    if (summary) observer.observe(summary);
    if (footer) observer.observe(footer);
    observer.observe(root);
    return () => {
      observer.disconnect();
      detail?.removeEventListener("sheet-settled", measure);
    };
  }, [explorerRef, detailRef, selection, searching, state, layoutFull, mobile]);
}
