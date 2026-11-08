import { useEffect, type RefObject } from "react";
import { floatingDetail } from "../../features/map/map-dismiss";
export function useExplorerLayout(
  explorerRef: RefObject<HTMLElement | null>,
  detailRef: RefObject<HTMLElement | null>,
  selection: unknown,
  searching: boolean,
  sheetCollapsed: boolean,
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
    const measure = () => {
      if (!detail || !floatingDetail(root.clientWidth, root.clientHeight)) {
        root.style.setProperty("--detail-sheet-height", "0px");
        return;
      }
      const peek = actions?.offsetHeight ?? 0;
      const safeArea = parseFloat(getComputedStyle(detail).paddingBottom) || 0;
      const height = detail.offsetHeight;
      detail.style.setProperty("--sheet-peek-height", `${peek}px`);
      root.style.setProperty(
        "--detail-sheet-height",
        `${sheetCollapsed ? peek + safeArea : height}px`,
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (detail) observer.observe(detail);
    if (actions) observer.observe(actions);
    observer.observe(root);
    return () => {
      observer.disconnect();
      root.style.setProperty("--detail-sheet-height", "0px");
    };
  }, [explorerRef, detailRef, selection, searching, sheetCollapsed]);
}
