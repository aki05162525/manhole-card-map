import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  type RefObject,
} from "react";
import {
  sheetAfterSwipe,
  sheetDragOffset,
  sheetReleaseDuration,
  smoothedVelocity,
  type SheetAction,
  type SheetAnchors,
  type SheetState,
} from "../../features/map/detail-sheet";
import { floatingDetail, reducedMotion } from "../../features/map/screen-shape";
import {
  SHEET_OPEN_CURVE,
  SHEET_OPEN_MS,
} from "../../features/map/sheet-motion";

type Drag = {
  start: number;
  base: number;
  top: number;
  y: number;
  time: number;
  velocity: number;
  anchors: SheetAnchors;
  /** The map controls, with where each was drawn when the drag began. */
  controls: { element: HTMLElement; base: number }[];
};
type Options = {
  panelRef: RefObject<HTMLElement | null>;
  state: SheetState;
  /** Changes whenever the sheet body is replaced. */
  bodyKey: unknown;
  getAnchors(): SheetAnchors;
  onAction(action: SheetAction): void;
};
// The controls that use-explorer-layout lifts by --detail-sheet-height.
const CONTROLS =
  "#locate, .maplibregl-ctrl-bottom-right, .maplibregl-ctrl-bottom-left";
const unride = (control: HTMLElement) => {
  control.style.removeProperty("transition");
  control.style.removeProperty("transform");
};

/**
 * Moves the sheet, and the map controls above it, on the compositor only:
 * no React state or layout per frame. On release the sheet heads for the
 * pixel position of its stop at once, without waiting for React or the
 * history, and use-detail-sheet hands it back to the CSS once it is there
 * (`data-sheet-stop`).
 */
export function useSheetDrag({
  panelRef,
  state,
  bodyKey,
  getAnchors,
  onAction,
}: Options) {
  const drag = useRef<Drag | null>(null);
  const pointer = useRef<{ id: number; target: HTMLElement } | null>(null);
  const landing = useRef<number | undefined>(undefined);
  const latest = useRef({ state, getAnchors, onAction });
  useEffect(() => {
    latest.current = { state, getAnchors, onAction };
  }, [state, getAnchors, onAction]);
  useEffect(() => () => window.clearTimeout(landing.current), []);
  const floating = useCallback(() => {
    const root = panelRef.current?.closest<HTMLElement>(".explorer");
    return !!root && floatingDetail(root.clientWidth, root.clientHeight);
  }, [panelRef]);
  const begin = useCallback(
    (y: number, time: number) => {
      const element = panelRef.current;
      if (!element) return;
      // Read the drawn positions first, so that a sheet still in transition
      // is caught where it is, and the controls riding on it with it.
      const drawn = (node: HTMLElement) =>
        new DOMMatrixReadOnly(getComputedStyle(node).transform).m42;
      const base = drawn(element);
      const controls = Array.from(
        element.closest(".explorer")?.querySelectorAll<HTMLElement>(CONTROLS) ??
          [],
        (control) => ({ element: control, base: drawn(control) }),
      );
      const anchors = latest.current.getAnchors();
      window.clearTimeout(landing.current);
      for (const control of controls) {
        control.element.style.transition = "none";
        control.element.style.transform = `translateY(${control.base}px)`;
      }
      drag.current = {
        start: y,
        base,
        top: base,
        y,
        time,
        velocity: 0,
        anchors,
        controls,
      };
      element.classList.add("is-dragging");
      element.removeAttribute("data-sheet-stop");
      element.removeAttribute("data-sheet-from");
      element.style.animation = "none";
      element.style.transition = "none";
      element.style.transform = `translateY(${base}px)`;
    },
    [panelRef],
  );
  const move = useCallback(
    (y: number, time: number) => {
      const current = drag.current;
      if (!current || !panelRef.current) return;
      current.velocity = smoothedVelocity(
        current.velocity,
        y - current.y,
        time - current.time,
      );
      current.y = y;
      current.time = time;
      current.top = sheetDragOffset(current.base, y - current.start);
      panelRef.current.style.transform = `translateY(${current.top}px)`;
      // The controls ride on the sheet's edge, no higher than the summary's.
      const { summary } = current.anchors;
      const offset =
        Math.max(current.top, summary) - Math.max(current.base, summary);
      for (const control of current.controls)
        // oxlint-disable-next-line react/immutability -- the elements are held in the drag's ref and moved from a pointer handler, not during render; the rule loses that through for...of
        control.element.style.transform = `translateY(${control.base + offset}px)`;
    },
    [panelRef],
  );
  /**
   * The controls return to their CSS, now the next stop's, and the action
   * bar comes or goes, over the sheet's own motion.
   */
  const land = useCallback(
    (riding: Drag["controls"], duration: number) => {
      const controls = riding.map(({ element }) => element);
      const bar = panelRef.current
        ?.closest(".explorer")
        ?.querySelector<HTMLElement>(".sheet-action-bar");
      const moving = bar ? [...controls, bar] : controls;
      for (const element of moving) {
        element.style.removeProperty("transition");
        element.style.transitionDuration = `${duration}ms`;
        element.style.transitionTimingFunction = SHEET_OPEN_CURVE;
      }
      controls.forEach((control) => control.style.removeProperty("transform"));
      landing.current = window.setTimeout(() => {
        for (const element of moving) {
          element.style.removeProperty("transition-duration");
          element.style.removeProperty("transition-timing-function");
        }
      }, duration + 100);
    },
    [panelRef],
  );
  const release = useCallback(
    (stop?: SheetState, velocity = 0) => {
      const current = drag.current;
      drag.current = null;
      const element = panelRef.current;
      if (!element || !current) return;
      element.classList.remove("is-dragging");
      element.setAttribute("data-sheet-moving", "");
      const target = stop ?? latest.current.state;
      const position = current.anchors[target];
      // With reduced motion, the CSS of the next state applies at once.
      if (reducedMotion()) {
        element.style.transition = "none";
        element.style.removeProperty("transform");
        current.controls.forEach(({ element }) => unride(element));
        return;
      }
      const duration = sheetReleaseDuration(position - current.top, velocity);
      element.style.transition = `transform ${duration}ms ${SHEET_OPEN_CURVE}`;
      element.style.transform = `translateY(${position}px)`;
      // use-detail-sheet hands the stop back to the CSS once the state is
      // `target`, and lets go of it if a later step changes the state first.
      element.setAttribute("data-sheet-stop", target);
      element.setAttribute("data-sheet-from", latest.current.state);
      land(current.controls, duration);
    },
    [panelRef, land],
  );
  const end = useCallback(
    (y: number, time: number) => {
      const current = drag.current;
      if (!current) return;
      const velocity = time - current.time > 100 ? 0 : current.velocity;
      current.anchors = latest.current.getAnchors();
      current.top = sheetDragOffset(current.base, y - current.start);
      const action = sheetAfterSwipe(
        latest.current.state,
        y - current.start,
        velocity,
        current.anchors,
        current.top,
      );
      if (action === "close") {
        // The closing animation continues from the finger's position.
        drag.current = null;
        panelRef.current?.classList.remove("is-dragging");
        if (reducedMotion())
          current.controls.forEach(({ element }) => unride(element));
        else land(current.controls, SHEET_OPEN_MS);
      } else release(action === "stay" ? undefined : action, velocity);
      latest.current.onAction(action);
    },
    [panelRef, release, land],
  );

  // Drop the old gesture before the replacement body can receive input.
  useLayoutEffect(() => {
    const panel = panelRef.current;
    const body = panel?.querySelector<HTMLElement>(".detail-body");
    const cancelDrag = () => {
      const captured = pointer.current;
      const current = drag.current;
      pointer.current = null;
      drag.current = null;
      if (captured?.target.hasPointerCapture(captured.id))
        captured.target.releasePointerCapture(captured.id);
      if (!current) return;
      current.controls.forEach(({ element }) => unride(element));
      panel?.classList.remove("is-dragging");
      panel?.style.removeProperty("animation");
      panel?.style.removeProperty("transition");
      panel?.style.removeProperty("transform");
    };
    if (!body) return cancelDrag;
    let startY = 0;
    let undecided = false;
    const start = (event: TouchEvent) => {
      startY = event.touches[0].clientY;
      undecided = event.touches.length === 1 && floating();
    };
    const touchMove = (event: TouchEvent) => {
      const { clientY } = event.touches[0];
      if (undecided) {
        const distance = clientY - startY;
        if (distance === 0) return;
        undecided = false;
        // Downward from the top moves the sheet. Everything else scrolls the body.
        if (
          (latest.current.state !== "full" ||
            (distance > 0 && body.scrollTop <= 0)) &&
          event.cancelable
        )
          begin(startY, event.timeStamp);
      }
      if (!drag.current) return;
      if (event.cancelable) event.preventDefault();
      move(clientY, event.timeStamp);
    };
    const touchEnd = (event: TouchEvent) => {
      undecided = false;
      end(event.changedTouches[0].clientY, event.timeStamp);
    };
    const touchCancel = () => {
      undecided = false;
      release();
      latest.current.onAction("stay");
    };
    body.addEventListener("touchstart", start, { passive: true });
    body.addEventListener("touchmove", touchMove, { passive: false });
    body.addEventListener("touchend", touchEnd);
    body.addEventListener("touchcancel", touchCancel);
    return () => {
      body.removeEventListener("touchstart", start);
      body.removeEventListener("touchmove", touchMove);
      body.removeEventListener("touchend", touchEnd);
      body.removeEventListener("touchcancel", touchCancel);
      cancelDrag();
    };
  }, [bodyKey, panelRef, floating, begin, move, end, release]);

  return {
    onPointerDown(event: React.PointerEvent<HTMLElement>) {
      if (event.button !== 0 || !floating()) return;
      const button =
        event.target instanceof Element && event.target.closest("button");
      if (button && !button.classList.contains("detail-drag-handle")) return;
      pointer.current = { id: event.pointerId, target: event.currentTarget };
      event.currentTarget.setPointerCapture(event.pointerId);
      begin(event.clientY, event.timeStamp);
    },
    onPointerMove(event: React.PointerEvent<HTMLElement>) {
      if (pointer.current?.id === event.pointerId)
        move(event.clientY, event.timeStamp);
    },
    onPointerUp(event: React.PointerEvent<HTMLElement>) {
      if (pointer.current?.id !== event.pointerId) return;
      pointer.current = null;
      end(event.clientY, event.timeStamp);
    },
    onPointerCancel(event: React.PointerEvent<HTMLElement>) {
      if (pointer.current?.id !== event.pointerId) return;
      pointer.current = null;
      release();
      latest.current.onAction("stay");
    },
  };
}
