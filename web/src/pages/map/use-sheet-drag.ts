import { useCallback, useEffect, useRef, type RefObject } from "react";
import {
  sheetAfterSwipe,
  sheetDragOffset,
  smoothedVelocity,
  type SheetAction,
  type SheetState,
} from "../../features/map/detail-sheet";
import { floatingDetail } from "../../features/map/map-dismiss";

type Drag = {
  start: number;
  base: number;
  y: number;
  time: number;
  velocity: number;
};
type Options = {
  panel: RefObject<HTMLElement | null>;
  state: SheetState;
  /** Changes whenever the sheet body is replaced. */
  bodyKey: unknown;
  onAction(action: SheetAction): void;
};

/** Moves the sheet on the compositor only: no React state or layout per frame. */
export function useSheetDrag({ panel, state, bodyKey, onAction }: Options) {
  const drag = useRef<Drag | null>(null);
  const pointer = useRef<number | null>(null);
  const latest = useRef({ state, onAction });
  useEffect(() => {
    latest.current = { state, onAction };
  }, [state, onAction]);
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
      drag.current = { start: y, base, y, time, velocity: 0 };
      element.classList.add("is-dragging");
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
      panel.current.style.transform = `translateY(${sheetDragOffset(current.base, y - current.start)}px)`;
    },
    [panel],
  );
  const release = useCallback(() => {
    drag.current = null;
    const element = panel.current;
    if (!element) return;
    element.classList.remove("is-dragging");
    element.setAttribute("data-sheet-moving", "");
    element.style.transition = matchMedia("(prefers-reduced-motion: reduce)")
      .matches
      ? "none"
      : "transform 280ms cubic-bezier(.2,.8,.2,1)";
    element.style.transform = "";
  }, [panel]);
  const end = useCallback(
    (y: number, time: number) => {
      const current = drag.current;
      if (!current) return;
      const velocity = time - current.time > 100 ? 0 : current.velocity;
      const action = sheetAfterSwipe(
        latest.current.state,
        y - current.start,
        velocity,
      );
      if (action === "close") {
        // The closing animation continues from the finger's position.
        drag.current = null;
        panel.current?.classList.remove("is-dragging");
      } else release();
      latest.current.onAction(action);
    },
    [panel, release],
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
