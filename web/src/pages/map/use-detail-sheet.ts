import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import {
  floatingDetail,
  mapDismissAction,
} from "../../features/map/map-dismiss";
import { useSheetDrag } from "./use-sheet-drag";
import type { useDetailSelection } from "./use-detail-selection";
// Keep in sync with the .detail-panel transition in style.css.
const SHEET_TRANSITION_MS = 200;
export function useDetailSheet(
  explorerRef: RefObject<HTMLElement | null>,
  detail: ReturnType<typeof useDetailSelection>,
) {
  const {
    setRevealedLid,
    setSelection,
    searchDetail,
    dismissCard,
    cardId,
    issues,
    closeCard,
    selection,
  } = detail;
  const [sheetCollapsed, setSheetCollapsed] = useState(false);
  const closing = useRef<number | undefined>(undefined);
  const detailRef = useRef<HTMLElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const mapClickStart = useRef<number | null>(null);
  const resetSheet = useCallback(() => {
    window.clearTimeout(closing.current);
    detailRef.current?.style.removeProperty("transform");
    detailRef.current?.style.removeProperty("transition");
    detailRef.current?.style.removeProperty("animation");
    setSheetCollapsed(false);
  }, []);
  const showSelection = detail.show;
  const selectCard = detail.selectCard;
  const show = useCallback(
    (
      ids: string[],
      selectedId?: string,
      started = performance.now(),
      pinId?: string,
    ) => {
      if (!detailRef.current && document.activeElement instanceof HTMLElement)
        returnFocus.current = document.activeElement;
      resetSheet();
      showSelection(ids, selectedId, started, pinId);
    },
    [resetSheet, showSelection],
  );
  const selectFromMap = useCallback(
    (ids: string[], pinId: string) => {
      const started = mapClickStart.current ?? performance.now();
      mapClickStart.current = null;
      if (ids.length === 1) selectCard(ids[0]);
      show(ids, undefined, started, pinId);
    },
    [show, selectCard],
  );
  useEffect(resetSheet, [resetSheet, cardId, detail.cards]);
  const close = useCallback(() => {
    setRevealedLid(undefined);
    setSelection(null);
    if (searchDetail) dismissCard();
    else if (cardId || issues.length) closeCard();
    returnFocus.current?.focus();
  }, [
    cardId,
    issues.length,
    closeCard,
    searchDetail,
    dismissCard,
    setRevealedLid,
    setSelection,
    returnFocus,
  ]);
  const collapseSheet = useCallback(() => {
    const detail = detailRef.current;
    if (detail?.querySelector(".detail-body")?.contains(document.activeElement))
      detail.querySelector<HTMLElement>(".detail-close")?.focus();
    setSheetCollapsed(true);
  }, [detailRef, setSheetCollapsed]);
  const closeSheet = useCallback(() => {
    const root = explorerRef.current;
    const panel = detailRef.current;
    if (
      !root ||
      !panel ||
      !floatingDetail(root.clientWidth, root.clientHeight) ||
      matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      close();
      return;
    }
    root.style.setProperty("--detail-sheet-height", "0px");
    panel.style.animation = "none";
    panel.style.transition =
      "transform var(--sheet-close) var(--sheet-close-easing)";
    panel.style.transform = "translateY(100%)";
    closing.current = window.setTimeout(close, SHEET_TRANSITION_MS);
  }, [close, explorerRef, detailRef, closing]);
  const sheetDrag = useSheetDrag({
    panel: detailRef,
    collapsed: sheetCollapsed,
    bodyKey: selection,
    onAction: (action) => {
      if (action === "close") closeSheet();
      else if (action === "collapse") collapseSheet();
      else if (action === "expand") setSheetCollapsed(false);
    },
  });
  const dismissFromMap = useCallback(() => {
    const root = explorerRef.current;
    if (
      root &&
      mapDismissAction(root.clientWidth, root.clientHeight) === "collapse"
    ) {
      collapseSheet();
      return;
    }
    close();
  }, [close, collapseSheet, explorerRef]);
  return {
    close,
    collapseSheet,
    closeSheet,
    sheetDrag,
    dismissFromMap,
    show,
    selectFromMap,
    sheetCollapsed,
    setSheetCollapsed,
    detailRef,
    mapClickStart,
  };
}
