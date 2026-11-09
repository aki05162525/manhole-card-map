import { useEffect, type RefObject } from "react";
import type { SheetState } from "../../features/map/detail-sheet";
import { floatingDetail } from "../../features/map/map-dismiss";
export function useExplorerLayout(
  explorerRef: RefObject<HTMLElement | null>,
  detailRef: RefObject<HTMLElement | null>,
  selection: unknown,
  searching: boolean,
  state: SheetState,
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
  useEffect(() => {
    const root = explorerRef.current;
    const detail = detailRef.current;
    if (!root) return;
    const actions = detail?.querySelector<HTMLElement>(".detail-actions");
    const summary = detail?.querySelector<HTMLElement>(".sheet-summary");
    const measure = () => {
      if (!detail || !floatingDetail(root.clientWidth, root.clientHeight)) {
        root.style.setProperty("--detail-sheet-height", "0px");
        return;
      }
      const peek = actions?.offsetHeight ?? 0;
      const safeArea = parseFloat(getComputedStyle(detail).paddingBottom) || 0;
      detail.classList.remove("is-compact");
      const content = summary?.offsetHeight ?? 0;
      const limit = Math.min(root.clientHeight * 0.56, 440);
      if (state === "summary" && summary)
        detail.classList.toggle(
          "is-compact",
          peek + content + safeArea + 16 > limit,
        );
      const height = summary
        ? Math.min(limit, peek + content + safeArea + 16)
        : detail.offsetHeight;
      detail.style.setProperty("--sheet-peek-height", `${peek}px`);
      detail.style.setProperty("--sheet-summary-height", `${height}px`);
      root.style.setProperty(
        "--detail-sheet-height",
        `${state === "collapsed" ? peek + safeArea : height}px`,
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (detail) observer.observe(detail);
    if (actions) observer.observe(actions);
    if (summary) observer.observe(summary);
    observer.observe(root);
    return () => {
      observer.disconnect();
      root.style.setProperty("--detail-sheet-height", "0px");
    };
  }, [explorerRef, detailRef, selection, searching, state]);
}
