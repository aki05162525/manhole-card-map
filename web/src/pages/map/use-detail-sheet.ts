import {
  useCallback,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
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
type DetailSection = "hours" | "places" | "record";
const sectionSelectors: Record<DetailSection, string> = {
  hours: ".detail-full-hours",
  places: ".facility + .facility",
  record: ".record-editor",
};
export function useDetailSheet(
  explorerRef: RefObject<HTMLElement | null>,
  detail: ReturnType<typeof useDetailSelection>,
) {
  const {
    setRevealedLid,
    revealedLid,
    showPlaces,
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
  // Accessibility and scrolling change only after the compositor has finished.
  const [layoutFull, setLayoutFull] = useState(false);
  const pendingMap = useRef<(() => void) | null>(null);
  const motionTimer = useRef<number | undefined>(undefined);
  const pendingClose = useRef(false);
  const pendingCollapsed = useRef(false);
  const pendingGroup = useRef<(() => void) | null>(null);
  const fullTarget = useRef<DetailSection | undefined>(undefined);
  const wasFull = useRef(false);
  const sheetCollapsed = sheetState === "collapsed";
  const full = mobile && sheetState === "full";
  const finishMotion = useCallback(() => {
    window.clearTimeout(motionTimer.current);
    detailRef.current?.removeAttribute("data-sheet-moving");
    detailRef.current?.style.removeProperty("transition");
    setLayoutFull(full);
    if (full === layoutFull)
      detailRef.current?.dispatchEvent(new Event("sheet-settled"));
  }, [full, layoutFull]);
  const waitForMotion = useCallback(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      finishMotion();
      return;
    }
    detailRef.current?.setAttribute("data-sheet-moving", "");
    window.clearTimeout(motionTimer.current);
    // No transitionend is emitted when a drag lands exactly on its target.
    motionTimer.current = window.setTimeout(finishMotion, 360);
  }, [finishMotion]);
  useEffect(() => () => window.clearTimeout(motionTimer.current), []);
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
    window.clearTimeout(motionTimer.current);
    detailRef.current?.style.removeProperty("transform");
    detailRef.current?.style.removeProperty("transition");
    detailRef.current?.style.removeProperty("animation");
    setOpening(true);
    setSheetState("summary");
    setLayoutFull(false);
    detailRef.current?.removeAttribute("data-sheet-moving");
    pendingMap.current = null;
    pendingCollapsed.current = false;
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
    if (revealedLid) showPlaces();
    setRevealedLid(undefined);
    setSelection(null);
    if (searchDetail) dismissCard();
    else if (cardId || issues.length) closeCard();
    returnFocus.current?.focus();
  }, [
    revealedLid,
    showPlaces,
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
    if (
      detail?.querySelector(".detail-body")?.contains(document.activeElement) ||
      explorerRef.current
        ?.querySelector(".sheet-action-bar")
        ?.contains(document.activeElement)
    )
      detail?.querySelector<HTMLElement>(".detail-close")?.focus();
    if (sheetState === "summary") {
      setOpening(false);
      setSheetState("collapsed");
    }
  }, [sheetState, explorerRef]);
  const expandSheet = useCallback(
    (section?: DetailSection, fromSwipe = false) => {
      if (!mobile) return;
      if (sheetState === "full") {
        if (section)
          detailRef.current
            ?.querySelector<HTMLElement>(sectionSelectors[section])
            ?.scrollIntoView({ block: "start" });
        return;
      }
      setOpening(true);
      if (sheetState === "collapsed" && !fromSwipe) {
        setSheetState("summary");
        return;
      }
      fullTarget.current = section;
      detailRef.current?.setAttribute("data-sheet-moving", "");
      history.pushState({ ...history.state, sheet: "full" }, "");
      setSheetState("full");
    },
    [mobile, sheetState],
  );
  const summarizeSheet = useCallback(() => {
    if (sheetState === "full") history.back();
    else setSheetState("summary");
  }, [sheetState]);
  const moveMap = (move: () => void) => {
    if (!full) {
      move();
      return;
    }
    pendingMap.current = move;
    history.back();
  };
  useLayoutEffect(() => {
    if (
      full === layoutFull &&
      !detailRef.current?.hasAttribute("data-sheet-moving")
    )
      return;
    waitForMotion();
    return () => window.clearTimeout(motionTimer.current);
  }, [full, layoutFull, sheetState, waitForMotion]);
  useEffect(() => {
    if (full || layoutFull || !pendingMap.current) return;
    // useExplorerLayout has measured the restored summary in its layout effect.
    const move = pendingMap.current;
    pendingMap.current = null;
    move();
  }, [full, layoutFull]);
  const closeOnHistory = useEffectEvent(() => close());
  useEffect(() => {
    const restore = () => {
      // SPIKE(keep-map-alive): the catalog in this document owns /cards entries.
      if (location.pathname === "/cards") return;
      setOpening(history.state?.sheet === "full");
      setSheetState(
        history.state?.sheet === "full"
          ? "full"
          : pendingCollapsed.current
            ? "collapsed"
            : "summary",
      );
      pendingCollapsed.current = false;
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
    if (!layoutFull) {
      if (wasFull.current) {
        panel.querySelector<HTMLElement>(".detail-body")?.scrollTo?.(0, 0);
        (
          (panel.classList.contains("is-collapsed")
            ? panel.querySelector<HTMLElement>(".detail-close")
            : root.querySelector<HTMLElement>(".sheet-more")) ??
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
        node.id !== "sheet-action-bar" &&
        !node.hasAttribute("inert"),
    );
    siblings.forEach((node) => node.setAttribute("inert", ""));
    const prelude = panel.querySelector<HTMLElement>(".detail-heading");
    panel
      .querySelector<HTMLElement>(
        prelude && getComputedStyle(prelude).display === "none"
          ? ".sheet-summary h2, .sheet-summary h3"
          : "h2",
      )
      ?.focus({ preventScroll: true });
    const target = fullTarget.current;
    fullTarget.current = undefined;
    if (target)
      panel
        .querySelector<HTMLElement>(sectionSelectors[target])
        ?.scrollIntoView?.({ block: "start" });
    return () => siblings.forEach((node) => node.removeAttribute("inert"));
  }, [layoutFull, explorerRef]);
  useLayoutEffect(() => {
    const panel = detailRef.current;
    panel?.querySelectorAll<HTMLElement>(".sheet-extra").forEach((node) => {
      node.toggleAttribute("inert", mobile && !layoutFull);
    });
  }, [mobile, layoutFull, selection]);
  const closeSheet = useCallback(
    (fromDrag = false) => {
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
      panel.style.transition = fromDrag
        ? "transform 280ms cubic-bezier(.2,.8,.2,1)"
        : "transform var(--sheet-close) var(--sheet-close-easing)";
      panel.style.transform = "translateY(100%)";
      closing.current = window.setTimeout(
        close,
        fromDrag ? 280 : SHEET_TRANSITION_MS,
      );
    },
    [close, explorerRef, sheetState],
  );
  const sheetDrag = useSheetDrag({
    panel: detailRef,
    state: sheetState,
    bodyKey: selection,
    getAnchors: () => {
      const panel = detailRef.current;
      const height = panel?.offsetHeight ?? 0;
      const style = panel ? getComputedStyle(panel) : null;
      // Reuse layout's measured levels, which stay fixed throughout motion.
      const summary =
        parseFloat(style?.getPropertyValue("--sheet-summary-height") ?? "") ||
        0;
      const peek =
        parseFloat(style?.getPropertyValue("--sheet-peek-height") ?? "") || 0;
      const inset = parseFloat(style?.paddingBottom ?? "") || 0;
      return {
        full: 0,
        summary: height - summary,
        collapsed: height - peek - inset,
      };
    },
    onAction: (action) => {
      if (action === "close") closeSheet(true);
      else if (action === "collapsed") {
        if (sheetState === "full") {
          pendingCollapsed.current = true;
          history.back();
        } else collapseSheet();
      } else if (action === "full") expandSheet(undefined, true);
      else if (action === "summary") summarizeSheet();
      else waitForMotion();
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
    layoutFull,
    finishMotion,
    moveMap,
    mobile,
    expandSheet,
    summarizeSheet,
    detailRef,
    mapClickStart,
  };
}
