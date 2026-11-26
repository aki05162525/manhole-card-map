import { detailSelector } from "../../shared/ui/detail-target";
import { useEffect, useLayoutEffect, type RefObject } from "react";
import type { SheetState } from "../../features/map/detail-sheet";
import { floatingDetail } from "../../features/map/screen-shape";
import {
  SHEET_SUMMARY_GAP,
  sheetSummaryLimit,
} from "../../features/map/sheet-motion";
/**
 * Lifts the locate button and the map's own controls (inside `.map-stage`,
 * also those MapLibre adds later) above the sheet. The height is set on them
 * alone: on the root it would restyle the whole page, sheet included.
 */
export function liftMapControls(root: HTMLElement, height: number) {
  for (const element of root.querySelectorAll<HTMLElement>(
    "#locate, .map-stage",
  ))
    if (
      element.style.getPropertyValue("--detail-sheet-height") !== `${height}px`
    )
      element.style.setProperty("--detail-sheet-height", `${height}px`);
}
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
  friendView = false,
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
  }, [explorerRef, friendView]);
  useLayoutEffect(() => {
    const root = explorerRef.current;
    const detail = detailRef.current;
    if (!root) return;
    const actions = detail?.querySelector<HTMLElement>(".detail-actions");
    const title = actions?.querySelector<HTMLElement>(".sheet-bar-title");
    const footer = root.querySelector<HTMLElement>(".sheet-action-bar");
    const summary = detail?.querySelector<HTMLElement>(".sheet-summary");
    const measure = () => {
      if (detail?.matches(".is-dragging")) return;
      if (detail?.matches("[data-sheet-moving]")) {
        // Nothing is measured or shortened while the sheet moves. The map
        // controls set off for the next stop with it, from its stored height.
        const peek = parseFloat(
          detail.style.getPropertyValue("--sheet-peek-height"),
        );
        const summary = parseFloat(
          detail.style.getPropertyValue("--sheet-summary-height"),
        );
        const lift =
          state === "collapsed"
            ? peek + (parseFloat(getComputedStyle(detail).paddingBottom) || 0)
            : summary;
        if (Number.isFinite(lift)) liftMapControls(root, lift);
        return;
      }
      if (!detail || !floatingDetail(root.clientWidth, root.clientHeight)) {
        liftMapControls(root, 0);
        return;
      }
      const safeArea = parseFloat(getComputedStyle(detail).paddingBottom) || 0;
      const footerHeight = footer?.offsetHeight ?? 0;
      root.style.setProperty("--sheet-action-height", `${footerHeight}px`);
      let bar = actions?.offsetHeight ?? 0;
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
          // Last, a card's image and its credit wait for the full view.
          "data-sheet-imageless",
        ];
        levels.forEach((level) => detail.removeAttribute(level));
        const limit = sheetSummaryLimit(root.clientHeight);
        const stop = summary?.querySelector<HTMLElement>(
          detailSelector("current-stop"),
        );
        for (const level of levels) {
          if (!stop || stop.scrollHeight <= stop.clientHeight + 1) break;
          detail.setAttribute(level, "");
        }
        bar = actions?.offsetHeight ?? 0;
        height = summary
          ? bar +
            summary.offsetHeight +
            (footerHeight || safeArea) +
            SHEET_SUMMARY_GAP
          : detail.offsetHeight;
        height = Math.min(limit || height, height);
      }
      // Folded away, the sheet shows its bar and the whole of the title,
      // which runs past the bar's bottom edge (style.css), under its border.
      const peek =
        detail.clientTop +
        Math.max(bar, title ? title.offsetTop + title.scrollHeight : 0);
      detail.style.setProperty("--sheet-peek-height", `${peek}px`);
      detail.style.setProperty("--sheet-bar-height", `${bar}px`);
      detail.style.setProperty("--sheet-summary-height", `${height}px`);
      liftMapControls(root, state === "collapsed" ? peek + safeArea : height);
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
