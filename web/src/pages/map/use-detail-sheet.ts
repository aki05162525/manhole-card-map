import {
  useCallback,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type RefObject,
} from "react";
import {
  floatingDetail,
  mapDismissAction,
} from "../../features/map/map-dismiss";
import type { SheetState } from "../../features/map/detail-sheet";
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
  const [sheetState, setSheetState] = useState<SheetState>("summary");
  const [opening, setOpening] = useState(true);
  const [mobile, setMobile] = useState(false);
  const pendingClose = useRef(false);
  const pendingGroup = useRef<(() => void) | null>(null);
  const fullTarget = useRef<"hours" | "places" | undefined>(undefined);
  const wasFull = useRef(false);
  const sheetCollapsed = sheetState === "collapsed";
  const full = mobile && sheetState === "full";
  useEffect(() => {
    const root = explorerRef.current;
    if (!root) return;
    const measure = () =>
      setMobile(floatingDetail(root.clientWidth, root.clientHeight));
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    measure();
    return () => observer.disconnect();
  }, [explorerRef]);
  useEffect(() => {
    // A reload always starts with the summary, even on a full-view history entry.
    if (history.state?.sheet === "full")
      history.replaceState({ ...history.state, sheet: undefined }, "");
  }, []);
  const closing = useRef<number | undefined>(undefined);
  const detailRef = useRef<HTMLElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const mapClickStart = useRef<number | null>(null);
  const resetSheet = useCallback(() => {
    window.clearTimeout(closing.current);
    detailRef.current?.style.removeProperty("transform");
    detailRef.current?.style.removeProperty("transition");
    detailRef.current?.style.removeProperty("animation");
    setOpening(true);
    setSheetState("summary");
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
  const chooseFromGroup = (id?: string) => {
    if (!selection) return;
    const choose = () => {
      if (id) selectCard(id);
      show(selection.ids, id, undefined, selection.pinId);
    };
    if (sheetState === "full") {
      pendingGroup.current = choose;
      history.back();
    } else choose();
  };
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
    if (sheetState === "summary") {
      setOpening(false);
      setSheetState("collapsed");
    }
  }, [sheetState]);
  const expandSheet = useCallback(
    (section?: "hours" | "places") => {
      if (!mobile || sheetState === "full") return;
      setOpening(true);
      if (sheetState === "collapsed") {
        setSheetState("summary");
        return;
      }
      fullTarget.current = section;
      history.pushState({ ...history.state, sheet: "full" }, "");
      setSheetState("full");
    },
    [mobile, sheetState],
  );
  const summarizeSheet = useCallback(() => {
    if (sheetState === "full") history.back();
    else setSheetState("summary");
  }, [sheetState]);
  const closeOnHistory = useEffectEvent(() => close());
  useEffect(() => {
    const restore = () => {
      setOpening(history.state?.sheet === "full");
      setSheetState(history.state?.sheet === "full" ? "full" : "summary");
      const choose = pendingGroup.current;
      pendingGroup.current = null;
      choose?.();
      if (pendingClose.current) {
        pendingClose.current = false;
        closeOnHistory();
      }
    };
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, []);
  useEffect(() => {
    const panel = detailRef.current;
    const root = explorerRef.current;
    if (!panel || !root) return;
    if (!full) {
      if (wasFull.current) {
        panel.querySelector<HTMLElement>(".detail-body")?.scrollTo?.(0, 0);
        (
          panel.querySelector<HTMLElement>(".sheet-more") ??
          panel.querySelector<HTMLElement>(".detail-drag-handle")
        )?.focus({ preventScroll: true });
      }
      wasFull.current = false;
      return;
    }
    wasFull.current = true;
    const siblings = Array.from(root.children).filter(
      (node): node is HTMLElement =>
        node instanceof HTMLElement &&
        node !== panel &&
        !node.hasAttribute("inert"),
    );
    siblings.forEach((node) => node.setAttribute("inert", ""));
    panel.querySelector<HTMLElement>("h2")?.focus({ preventScroll: true });
    const target = fullTarget.current;
    fullTarget.current = undefined;
    if (target)
      panel
        .querySelector<HTMLElement>(
          target === "hours" ? ".distribution-hours" : ".facility + .facility",
        )
        ?.scrollIntoView?.({ block: "start" });
    return () => siblings.forEach((node) => node.removeAttribute("inert"));
  }, [full, explorerRef, selection]);
  const closeSheet = useCallback(() => {
    if (sheetState === "full") {
      pendingClose.current = true;
      history.back();
      return;
    }
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
  }, [close, explorerRef, sheetState]);
  const sheetDrag = useSheetDrag({
    panel: detailRef,
    state: sheetState,
    bodyKey: selection,
    onAction: (action) => {
      if (action === "close") closeSheet();
      else if (action === "collapsed") collapseSheet();
      else if (action === "full") expandSheet();
      else if (action === "summary") summarizeSheet();
    },
  });
  const dismissFromMap = useCallback(() => {
    if (sheetState === "full" || (mobile && sheetState !== "summary")) return;
    const root = explorerRef.current;
    if (
      root &&
      mapDismissAction(root.clientWidth, root.clientHeight) === "collapse"
    ) {
      collapseSheet();
      return;
    }
    close();
  }, [close, collapseSheet, explorerRef, mobile, sheetState]);
  return {
    close,
    collapseSheet,
    closeSheet,
    sheetDrag,
    dismissFromMap,
    show,
    selectFromMap,
    chooseFromGroup,
    sheetCollapsed,
    sheetState,
    opening,
    full,
    mobile,
    expandSheet,
    summarizeSheet,
    detailRef,
    mapClickStart,
  };
}
