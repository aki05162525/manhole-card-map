import { useCallback, useEffect, useRef, type RefObject } from "react";
import {
  sheetAfterSwipe,
  sheetDragOffset,
  sheetReleaseDuration,
  smoothedVelocity,
  type SheetAction,
  type SheetAnchors,
  type SheetState,
} from "../../features/map/detail-sheet";
import { floatingDetail } from "../../features/map/map-dismiss";

type Drag = {
  start: number;
  base: number;
  top: number;
  y: number;
  time: number;
  velocity: number;
  anchors: SheetAnchors;
  /** Where the map controls rest for the state the drag began in. */
  rest: number;
  controls: HTMLElement[];
};
type Options = {
  panel: RefObject<HTMLElement | null>;
  state: SheetState;
  /** Changes whenever the sheet body is replaced. */
  bodyKey: unknown;
  getAnchors(): SheetAnchors;
  onAction(action: SheetAction): void;
};
// The controls that use-explorer-layout lifts by --detail-sheet-height.
const CONTROLS =
  "#locate, .maplibregl-ctrl-bottom-right, .maplibregl-ctrl-bottom-left";
const EASING = "cubic-bezier(.2,.8,.2,1)";
const reducedMotion = () =>
  matchMedia("(prefers-reduced-motion: reduce)").matches;
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
  panel,
  state,
  bodyKey,
  getAnchors,
  onAction,
}: Options) {
  const drag = useRef<Drag | null>(null);
  const pointer = useRef<number | null>(null);
  const landing = useRef<number | undefined>(undefined);
  const latest = useRef({ state, getAnchors, onAction });
  useEffect(() => {
    latest.current = { state, getAnchors, onAction };
  }, [state, getAnchors, onAction]);
  useEffect(() => () => window.clearTimeout(landing.current), []);
  const floating = useCallback(() => {
    const root = panel.current?.closest<HTMLElement>(".explorer");
    return !!root && floatingDetail(root.clientWidth, root.clientHeight);
  }, [panel]);
  const begin = useCallback(
    (y: number, time: number) => {
      const element = panel.current;
      if (!element) return;
      // Read the current position first so a sheet still in transition is caught.
      const base = new DOMMatrixReadOnly(getComputedStyle(element).transform)
        .m42;
      const anchors = latest.current.getAnchors();
      const { state } = latest.current;
      window.clearTimeout(landing.current);
      const controls = Array.from(
        element.closest(".explorer")?.querySelectorAll<HTMLElement>(CONTROLS) ??
          [],
      );
      controls.forEach((control) => (control.style.transition = "none"));
      drag.current = {
        start: y,
        base,
        top: base,
        y,
        time,
        velocity: 0,
        anchors,
        // In full view the controls stay at the summary's height.
        rest: anchors[state === "full" ? "summary" : state],
        controls,
      };
      element.classList.add("is-dragging");
      element.removeAttribute("data-sheet-stop");
      element.style.animation = "none";
      element.style.transition = "none";
      element.style.transform = `translateY(${base}px)`;
    },
    [panel],
  );
  const move = useCallback(
    (y: number, time: number) => {
      const current = drag.current;
      if (!current || !panel.current) return;
      current.velocity = smoothedVelocity(
        current.velocity,
        y - current.y,
        time - current.time,
      );
      current.y = y;
      current.time = time;
      current.top = sheetDragOffset(current.base, y - current.start);
      panel.current.style.transform = `translateY(${current.top}px)`;
      // The controls ride on the sheet's edge up to the summary's height.
      const offset =
        Math.max(current.top, current.anchors.summary) - current.rest;
      for (const control of current.controls)
        control.style.transform = `translateY(calc(${offset}px - var(--detail-sheet-height, 0px)))`;
    },
    [panel],
  );
  /**
   * The controls return to their CSS, now the next stop's, and the action
   * bar comes or goes, over the sheet's own motion.
   */
  const land = useCallback(
    (controls: HTMLElement[], duration: number) => {
      const bar = panel.current
        ?.closest(".explorer")
        ?.querySelector<HTMLElement>(".sheet-action-bar");
      const moving = bar ? [...controls, bar] : controls;
      for (const element of moving) {
        element.style.removeProperty("transition");
        element.style.transitionDuration = `${duration}ms`;
        element.style.transitionTimingFunction = EASING;
      }
      controls.forEach((control) => control.style.removeProperty("transform"));
      landing.current = window.setTimeout(() => {
        for (const element of moving) {
          element.style.removeProperty("transition-duration");
          element.style.removeProperty("transition-timing-function");
        }
      }, duration + 100);
    },
    [panel],
  );
  const release = useCallback(
    (stop?: SheetState, velocity = 0) => {
      const current = drag.current;
      drag.current = null;
      const element = panel.current;
      if (!element || !current) return;
      element.classList.remove("is-dragging");
      element.setAttribute("data-sheet-moving", "");
      const target = stop ?? latest.current.state;
      const position = current.anchors[target];
      // With reduced motion, the CSS of the next state applies at once.
      if (reducedMotion()) {
        element.style.transition = "none";
        element.style.removeProperty("transform");
        current.controls.forEach(unride);
        return;
      }
      const duration = sheetReleaseDuration(position - current.top, velocity);
      element.style.transition = `transform ${duration}ms ${EASING}`;
      element.style.transform = `translateY(${position}px)`;
      element.setAttribute("data-sheet-stop", target);
      land(current.controls, duration);
    },
    [panel, land],
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
        panel.current?.classList.remove("is-dragging");
        if (reducedMotion()) current.controls.forEach(unride);
        else land(current.controls, 280);
      } else release(action === "stay" ? undefined : action, velocity);
      latest.current.onAction(action);
    },
    [panel, release, land],
  );

  useEffect(() => {
    const body = panel.current?.querySelector<HTMLElement>(".detail-body");
    if (!body) return;
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
    };
  }, [bodyKey, panel, floating, begin, move, end, release]);

  return {
    onPointerDown(event: React.PointerEvent<HTMLElement>) {
      if (event.button !== 0 || !floating()) return;
      const button = (event.target as HTMLElement).closest("button");
      if (button && !button.classList.contains("detail-drag-handle")) return;
      pointer.current = event.pointerId;
      event.currentTarget.setPointerCapture(event.pointerId);
      begin(event.clientY, event.timeStamp);
    },
    onPointerMove(event: React.PointerEvent<HTMLElement>) {
      if (pointer.current === event.pointerId)
        move(event.clientY, event.timeStamp);
    },
    onPointerUp(event: React.PointerEvent<HTMLElement>) {
      if (pointer.current !== event.pointerId) return;
      pointer.current = null;
      end(event.clientY, event.timeStamp);
    },
    onPointerCancel() {
      pointer.current = null;
      release();
      latest.current.onAction("stay");
    },
  };
}
