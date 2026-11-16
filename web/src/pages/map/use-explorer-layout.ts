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
  // The data the sheet shows: details that arrive after a selection fill
  // it with its summary and action bar, which are measured from then on.
  content: unknown = null,
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
        // style.css holds the summary to the room under this limit, and the
        // current stop of the route gives way inside it. Each level shortens
        // the text; the next is tried only while that stop is still clipped.
        const levels = [
          "data-sheet-compact",
          "data-sheet-tight",
          "data-sheet-bare",
        ];
        levels.forEach((level) => detail.removeAttribute(level));
        // Keep in sync with the summary's max-block-size in style.css.
        const screen = root.clientHeight;
        const limit = Math.min(Math.max(screen * 0.56, 352), screen * 0.7, 440);
        const stop = summary?.querySelector<HTMLElement>(
          ".route-stop.is-current",
        );
        for (const level of levels) {
          if (!stop || stop.scrollHeight <= stop.clientHeight + 1) break;
          detail.setAttribute(level, "");
        }
        peek = actions?.offsetHeight ?? 0;
        height = summary
          ? peek + summary.offsetHeight + (footerHeight || safeArea) + 16
          : detail.offsetHeight;
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
  }, [
    explorerRef,
    detailRef,
    selection,
    searching,
    state,
    layoutFull,
    mobile,
    content,
  ]);
}
