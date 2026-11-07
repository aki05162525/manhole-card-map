import { useEffect, useRef, type RefObject } from "react";
import {
  sheetAfterSwipe,
  sheetDragOffset,
  smoothedVelocity,
  type SheetAction,
} from "./detail-sheet";
import { floatingDetail } from "./map-dismiss";

type Drag = {
  start: number;
  base: number;
  y: number;
  time: number;
  velocity: number;
};
type Options = {
  panel: RefObject<HTMLElement | null>;
  collapsed: boolean;
  /** Changes whenever the sheet body is replaced. */
  bodyKey: unknown;
  onAction(action: SheetAction): void;
};

/** Moves the sheet on the compositor only: no React state or layout per frame. */
export function useSheetDrag({ panel, collapsed, bodyKey, onAction }: Options) {
  const drag = useRef<Drag | null>(null);
  const pointer = useRef<number | null>(null);
  const latest = useRef({ collapsed, onAction });
  useEffect(() => {
    latest.current = { collapsed, onAction };
  });
  const floating = () => {
    const root = panel.current?.closest<HTMLElement>(".explorer");
    return !!root && floatingDetail(root.clientWidth, root.clientHeight);
  };
  const begin = (y: number, time: number) => {
    const element = panel.current;
    if (!element) return;
    // Read the current position first so a sheet still in transition is caught.
    const base = new DOMMatrixReadOnly(getComputedStyle(element).transform).m42;
    drag.current = { start: y, base, y, time, velocity: 0 };
    element.classList.add("is-dragging");
    element.style.animation = "none";
    element.style.transition = "none";
    element.style.transform = `translateY(${base}px)`;
  };
  const move = (y: number, time: number) => {
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
  };
  const release = () => {
    drag.current = null;
    const element = panel.current;
    if (!element) return;
    element.classList.remove("is-dragging");
    element.style.transition = "";
    element.style.transform = "";
  };
  const end = (y: number, time: number) => {
    const current = drag.current;
    if (!current) return;
    const velocity = time - current.time > 100 ? 0 : current.velocity;
    const action = sheetAfterSwipe(
      latest.current.collapsed,
      y - current.start,
      velocity,
    );
    if (action === "close") {
      // The closing animation continues from the finger's position.
      drag.current = null;
      panel.current?.classList.remove("is-dragging");
    } else release();
    latest.current.onAction(action);
  };

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
        if (distance > 0 && body.scrollTop <= 0 && event.cancelable)
          begin(clientY, event.timeStamp);
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
  }, [bodyKey]);

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
    },
  };
}
