import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type RefObject,
} from "react";

/** How far a finger moves on a drawing before it is a drag, not a press. */
const DRAG = 8;
/**
 * How long a press is still held after its finger lifts without a click:
 * the click a touch makes comes in its own task after the lift.
 */
const LIFT = 400;

/**
 * A move of the drawing in its own pixels, as a drag and a pinch make it:
 * the point at `p` is drawn at `scale * p + (x, y)`.
 */
export type StageMove = { scale: number; x: number; y: number };
const STILL: StageMove = { scale: 1, x: 0, y: 0 };
/** `after` applied to what `before` has moved. */
const then = (before: StageMove, after: StageMove): StageMove => ({
  scale: after.scale * before.scale,
  x: after.scale * before.x + after.x,
  y: after.scale * before.y + after.y,
});
type Point = { x: number; y: number };
/** The move of the fingers from where they were put down (or last counted). */
function fingers(points: { from: Point; to: Point }[]): StageMove {
  const [a, b] = points;
  if (!a) return STILL;
  if (!b) return { scale: 1, x: a.to.x - a.from.x, y: a.to.y - a.from.y };
  const apart = (p: Point, q: Point) => Math.hypot(p.x - q.x, p.y - q.y);
  const from = { x: (a.from.x + b.from.x) / 2, y: (a.from.y + b.from.y) / 2 };
  const to = { x: (a.to.x + b.to.x) / 2, y: (a.to.y + b.to.y) / 2 };
  const before = apart(a.from, b.from);
  const scale = before > 0 ? apart(a.to, b.to) / before : 1;
  return { scale, x: to.x - scale * from.x, y: to.y - scale * from.y };
}

/**
 * A drag, a pinch or a wheel on a drawing shown before the map engine: what
 * the map that moves answers. `onWant` asks for it. Where the drawing can
 * follow, `onMove` is told the move so far (in client pixels) and `onMoved`
 * the move once every finger has lifted; a wheel is told to `onWheel`. The
 * press that ended a drag is not a press (`dragged`). Every move goes on
 * being told after its finger leaves the drawing.
 */
export function useStageGestures(
  target: RefObject<HTMLElement | SVGSVGElement | null>,
  {
    onWant,
    onMove,
    onMoved,
    onWheel,
  }: {
    onWant(): void;
    onMove?(move: StageMove): void;
    onMoved?(move: StageMove): void;
    onWheel?(event: WheelEvent): void;
  },
) {
  const want = useEffectEvent(onWant);
  const move = useEffectEvent((value: StageMove) => onMove?.(value));
  const moved = useEffectEvent((value: StageMove) => onMoved?.(value));
  const wheel = useEffectEvent((event: WheelEvent) => {
    want();
    onWheel?.(event);
  });
  const dragged = useRef(false);
  useEffect(() => {
    // Either kind of element, by the events both have.
    const element: GlobalEventHandlers | null = target.current;
    if (!element) return;
    const down = new Map<number, { from: Point; to: Point }>();
    // The move of the fingers that have lifted or joined since it began.
    let counted = STILL;
    const sofar = () => then(counted, fingers([...down.values()]));
    /** Counts the move so far, and measures on from where the fingers are. */
    const recount = () => {
      counted = sofar();
      for (const point of down.values()) point.from = point.to;
    };
    const start = ({ pointerId, clientX, clientY }: PointerEvent) => {
      if (!down.size) {
        dragged.current = false;
        counted = STILL;
      } else recount();
      const at = { x: clientX, y: clientY };
      down.set(pointerId, { from: at, to: at });
      if (down.size > 1 && !dragged.current) {
        dragged.current = true;
        want();
      }
    };
    const shift = ({ pointerId, clientX, clientY }: PointerEvent) => {
      const point = down.get(pointerId);
      if (!point) return;
      point.to = { x: clientX, y: clientY };
      if (!dragged.current) {
        const { x, y } = sofar();
        if (Math.hypot(x, y) < DRAG) return;
        dragged.current = true;
        want();
      }
      move(sofar());
    };
    const end = ({ pointerId }: PointerEvent) => {
      if (!down.has(pointerId)) return;
      recount();
      down.delete(pointerId);
      if (!down.size && dragged.current) moved(counted);
    };
    const turn = (event: WheelEvent) => wheel(event);
    element.addEventListener("pointerdown", start);
    window.addEventListener("pointermove", shift);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    element.addEventListener("wheel", turn, { passive: true });
    return () => {
      element.removeEventListener("pointerdown", start);
      window.removeEventListener("pointermove", shift);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      element.removeEventListener("wheel", turn);
    };
  }, [target]);
  return dragged;
}

/**
 * Whether a finger or a button is down on the drawing, and until the press
 * it makes has been answered: the drawing it began on is not taken away
 * from under it.
 */
export function useStagePress(
  target: RefObject<HTMLElement | SVGSVGElement | null>,
) {
  const [pressing, setPressing] = useState(false);
  useEffect(() => {
    // Either kind of element, by the events both have.
    const element: GlobalEventHandlers | null = target.current;
    if (!element) return;
    const down = new Set<number>();
    let timer: number | undefined;
    const release = (after: number) => {
      clearTimeout(timer);
      timer = window.setTimeout(() => setPressing(false), after);
    };
    const start = ({ pointerId }: PointerEvent) => {
      down.add(pointerId);
      clearTimeout(timer);
      setPressing(true);
    };
    const end = ({ pointerId }: PointerEvent) => {
      if (!down.delete(pointerId) || down.size) return;
      release(LIFT);
    };
    // After the press's own listeners, in a task of its own.
    const answered = () => {
      if (!down.size) release(0);
    };
    element.addEventListener("pointerdown", start);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    element.addEventListener("click", answered);
    return () => {
      clearTimeout(timer);
      element.removeEventListener("pointerdown", start);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      element.removeEventListener("click", answered);
    };
  }, [target]);
  return pressing;
}
