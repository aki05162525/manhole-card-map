import { useEffect, useEffectEvent, useRef, type RefObject } from "react";

/** How far a finger moves on a drawing before it is a drag, not a press. */
const DRAG = 8;

/**
 * A drag, a pinch or a wheel on a drawing shown before the map engine: what
 * only the map that moves can answer. `onWant` asks for it; the map takes
 * over once it is ready. The press that ended a drag is not a press.
 */
export function useStageGestures(
  target: RefObject<HTMLElement | null>,
  onWant: () => void,
) {
  const want = useEffectEvent(onWant);
  const dragged = useRef(false);
  useEffect(() => {
    const element = target.current;
    if (!element) return;
    const down = new Map<number, { x: number; y: number }>();
    const start = ({ pointerId, clientX, clientY }: PointerEvent) => {
      if (!down.size) dragged.current = false;
      down.set(pointerId, { x: clientX, y: clientY });
      if (down.size > 1) {
        dragged.current = true;
        want();
      }
    };
    const move = ({ pointerId, clientX, clientY }: PointerEvent) => {
      const from = down.get(pointerId);
      if (!from || Math.hypot(clientX - from.x, clientY - from.y) < DRAG)
        return;
      dragged.current = true;
      want();
    };
    const end = ({ pointerId }: PointerEvent) => void down.delete(pointerId);
    const wheel = () => want();
    element.addEventListener("pointerdown", start);
    element.addEventListener("pointermove", move);
    element.addEventListener("pointerup", end);
    element.addEventListener("pointercancel", end);
    element.addEventListener("wheel", wheel, { passive: true });
    return () => {
      element.removeEventListener("pointerdown", start);
      element.removeEventListener("pointermove", move);
      element.removeEventListener("pointerup", end);
      element.removeEventListener("pointercancel", end);
      element.removeEventListener("wheel", wheel);
    };
  }, [target]);
  return dragged;
}
