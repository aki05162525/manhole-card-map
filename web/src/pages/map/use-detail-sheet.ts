import {
  detailSelector,
  type DetailSection,
} from "../../shared/ui/detail-target";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import {
  floatingDetail,
  mapDismissAction,
} from "../../features/map/map-dismiss";
import type { SheetState } from "../../features/map/detail-sheet";
import {
  flushHistoryWrites,
  routeHistory,
} from "../../shared/browser/app-history";
import {
  expandDetail,
  restoreDetail,
  reserve,
  release,
  takeMap,
  type PendingActions,
} from "./detail-sheet-state";
import { historyFields } from "./map-search-state";
import { useSheetDrag } from "./use-sheet-drag";
import { liftMapControls } from "./use-explorer-layout";
import type { useDetailSelection } from "./use-detail-selection";
// Keep in sync with the .detail-panel transition in style.css.
const SHEET_TRANSITION_MS = 200;
const entries = routeHistory("map");
/**
 * A released drag holds the sheet at its stop in pixels (`data-sheet-stop`,
 * use-sheet-drag) until the state is that stop and the motion has ended. It
 * is "waiting" while the state is still the one the drag began in
 * (`data-sheet-from`, as when the history has yet to answer), and
 * "replaced" once a later step has changed the state to another stop.
 */
function heldStop(panel: HTMLElement) {
  const stop = panel.getAttribute("data-sheet-stop");
  if (!stop) return null;
  if (panel.classList.contains(`is-${stop}`)) return "landed";
  const from = panel.getAttribute("data-sheet-from");
  return from && panel.classList.contains(`is-${from}`)
    ? "waiting"
    : "replaced";
}
/** Hands the sheet's position back to its state's CSS. */
function letGo(panel: HTMLElement) {
  panel.removeAttribute("data-sheet-stop");
  panel.removeAttribute("data-sheet-from");
  panel.style.removeProperty("transform");
  panel.style.removeProperty("transition");
}
const sheetInHistory = () => historyFields(entries.state()).sheet;
export function useDetailSheet(
  explorerRef: RefObject<HTMLElement | null>,
  detail: Pick<
    ReturnType<typeof useDetailSelection>,
    | "clearSelection"
    | "searchDetail"
    | "dismissCard"
    | "cardId"
    | "issues"
    | "closeCard"
    | "selection"
    | "show"
    | "selectCard"
    | "releaseCard"
    | "cards"
  >,
) {
  const {
    clearSelection,
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
  const detailRef = useRef<HTMLElement>(null);
  const pending = useRef<PendingActions>({});
  const motionTimer = useRef<number | undefined>(undefined);
  const fullTarget = useRef<DetailSection | undefined>(undefined);
  const wasFull = useRef(false);
  const sheetCollapsed = sheetState === "collapsed";
  const full = mobile && sheetState === "full";
  const finishMotion = useCallback(() => {
    window.clearTimeout(motionTimer.current);
    const panel = detailRef.current;
    panel?.removeAttribute("data-sheet-moving");
    const held = panel && heldStop(panel);
    if (panel && held === "landed") {
      // The state's CSS puts the sheet where the drag held it; without a
      // transition it does not move again.
      letGo(panel);
      panel.style.transition = "none";
      requestAnimationFrame(() => {
        if (!panel.classList.contains("is-dragging"))
          panel.style.removeProperty("transition");
      });
    } else if (panel && held === "replaced") letGo(panel);
    else if (!held) panel?.style.removeProperty("transition");
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
    if (sheetInHistory() === "full")
      entries.replace({ ...historyFields(entries.state()), sheet: undefined });
  }, []);
  const closing = useRef<number | undefined>(undefined);
  const returnFocus = useRef<HTMLElement | null>(null);
  const mapClickStart = useRef<number | null>(null);
  /** Takes what a motion or a drag left on the panel, and what waited on it. */
  const releasePanel = useCallback(() => {
    window.clearTimeout(closing.current);
    window.clearTimeout(motionTimer.current);
    detailRef.current?.style.removeProperty("transform");
    detailRef.current?.style.removeProperty("transition");
    detailRef.current?.style.removeProperty("animation");
    if (detailRef.current) letGo(detailRef.current);
    detailRef.current?.removeAttribute("data-sheet-moving");
    pending.current = release(pending.current);
  }, []);
  const resetSheet = useCallback(() => {
    releasePanel();
    setOpening(true);
    setSheetState("summary");
    setLayoutFull(false);
  }, [releasePanel]);
  const showSelection = detail.show;
  const { selectCard, releaseCard } = detail;
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
  const restoreSheet = useRef(() => {});
  /** Without a summary entry of the map behind, only the sheet itself returns. */
  const leaveFull = useCallback(() => {
    if (entries.back()) return;
    if (sheetInHistory() === "full")
      entries.replace({ ...historyFields(entries.state()), sheet: undefined });
    restoreSheet.current();
  }, []);
  const deferUntilBack = useCallback(
    (fullView: boolean, request: Parameters<typeof reserve>[2]) => {
      const next = reserve(fullView, pending.current, request);
      if (!next) return false;
      pending.current = next;
      leaveFull();
      return true;
    },
    [leaveFull],
  );
  const chooseFromGroup = (id?: string) => {
    if (!selection) return;
    const choose = () => {
      if (id) selectCard(id);
      show(selection.ids, id, undefined, selection.pinId);
    };
    if (!deferUntilBack(sheetState === "full", { group: choose })) choose();
  };
  /** The press that the map's own click answers a moment later. */
  const noteMapClick = useCallback((time: number) => {
    mapClickStart.current = time;
  }, []);
  const selectFromMap = useCallback(
    (ids: string[], pinId: string) => {
      const started = mapClickStart.current ?? performance.now();
      mapClickStart.current = null;
      if (ids.length === 1) selectCard(ids[0]);
      else releaseCard();
      show(ids, undefined, started, pinId);
    },
    [show, selectCard, releaseCard],
  );
  // Another card, or other cards, start with the summary: the state as
  // they are first drawn, and the panel before the layout effects below
  // read it.
  const [shown, setShown] = useState({ cardId, cards: detail.cards });
  if (shown.cardId !== cardId || shown.cards !== detail.cards) {
    setShown({ cardId, cards: detail.cards });
    setOpening(true);
    setSheetState("summary");
    setLayoutFull(false);
  }
  useLayoutEffect(releasePanel, [releasePanel, cardId, detail.cards]);
  const bodyKey = useMemo(() => ({ selection, shown }), [selection, shown]);
  const close = useCallback(() => {
    clearSelection();
    if (searchDetail) dismissCard();
    else if (cardId || issues.length) closeCard();
    returnFocus.current?.focus();
  }, [
    clearSelection,
    cardId,
    issues.length,
    closeCard,
    searchDetail,
    dismissCard,
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
      const next = expandDetail(sheetState, mobile, fromSwipe);
      if (next === "stay") {
        if (mobile && section)
          detailRef.current
            ?.querySelector<HTMLElement>(detailSelector(section))
            ?.scrollIntoView({ block: "start" });
        return;
      }
      setOpening(true);
      if (next === "summary") {
        setSheetState("summary");
        return;
      }
      fullTarget.current = section;
      detailRef.current?.setAttribute("data-sheet-moving", "");
      flushHistoryWrites();
      entries.push({ ...historyFields(entries.state()), sheet: "full" });
      setSheetState("full");
    },
    [mobile, sheetState],
  );
  const summarizeSheet = useCallback(() => {
    if (sheetState === "full") leaveFull();
    else {
      // Unfolding is an opening, for the action bar's motion too.
      if (sheetState === "collapsed") setOpening(true);
      setSheetState("summary");
    }
  }, [leaveFull, sheetState]);
  const moveMap = (move: () => void) => {
    if (!deferUntilBack(full, { map: move })) move();
  };
  useLayoutEffect(() => {
    const panel = detailRef.current;
    const held = panel && heldStop(panel);
    // The drag's own stop has come: only the end of its motion is awaited.
    if (held === "landed") panel?.removeAttribute("data-sheet-from");
    // A later step chose another stop: the new state's CSS takes the sheet
    // on from where it is.
    else if (panel && held === "replaced") letGo(panel);
  }, [sheetState]);
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
    if (full || layoutFull) return;
    // useExplorerLayout has measured the restored summary in its layout effect.
    const next = takeMap(pending.current);
    pending.current = next.pending;
    next.move?.();
  }, [full, layoutFull]);
  // What a back, or a full view left without one, does with the state as
  // it is now.
  useLayoutEffect(() => {
    restoreSheet.current = () => {
      const next = restoreDetail(sheetInHistory() === "full", pending.current);
      pending.current = next.pending;
      setOpening(next.opening);
      setSheetState(next.state);
      next.choose?.();
      if (next.close) close();
    };
  });
  useEffect(() => entries.subscribe(() => restoreSheet.current()), []);
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
            : root.querySelector<HTMLElement>(".detail-drag-handle")) ??
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
    panel.querySelector<HTMLElement>("h2")?.focus({ preventScroll: true });
    const target = fullTarget.current;
    fullTarget.current = undefined;
    if (target) {
      const destination = panel.querySelector<HTMLElement>(
        detailSelector(target),
      );
      if (target === "record") destination?.focus({ preventScroll: true });
      destination?.scrollIntoView?.({ block: "start" });
    }
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
      if (deferUntilBack(sheetState === "full", { close: true })) return;
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
      liftMapControls(root, 0);
      // The closing motion replaces whatever a drag had started.
      window.clearTimeout(motionTimer.current);
      panel.removeAttribute("data-sheet-moving");
      letGo(panel);
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
    [close, explorerRef, deferUntilBack, sheetState],
  );
  const sheetDrag = useSheetDrag({
    panelRef: detailRef,
    state: sheetState,
    bodyKey,
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
        if (!deferUntilBack(sheetState === "full", { collapse: true }))
          collapseSheet();
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
    noteMapClick,
  };
}
