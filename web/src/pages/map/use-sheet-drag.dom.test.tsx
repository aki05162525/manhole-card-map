import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { useRef } from "react";
import { useSheetDrag } from "./use-sheet-drag";

beforeEach(() => {
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
  vi.stubGlobal(
    "DOMMatrixReadOnly",
    class {
      m42 = 0;
    },
  );
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
function Sheet({
  collapsed = false,
  onAction,
  bodyKey = "card",
}: {
  collapsed?: boolean;
  onAction: (action: string) => void;
  bodyKey?: string;
}) {
  const panel = useRef<HTMLElement>(null);
  const handlers = useSheetDrag({
    panelRef: panel,
    state: collapsed ? "collapsed" : "summary",
    bodyKey,
    getAnchors: () => ({ full: 0, summary: 625, collapsed: 827 }),
    onAction,
  });
  return (
    <main className="explorer">
      <section ref={panel}>
        <div data-testid="handle" {...handlers} />
        <div className="detail-body" data-testid="body" />
      </section>
      <button
        type="button"
        id="locate"
        aria-label="現在地"
        data-testid="locate"
      />
      <div className="maplibregl-ctrl-bottom-right" data-testid="credit" />
    </main>
  );
}
function touch(element: HTMLElement, type: string, y: number, time?: number) {
  const event = new TouchEvent(type, {
    bubbles: true,
    cancelable: true,
    touches: [{ clientY: y } as Touch],
    changedTouches: [{ clientY: y } as Touch],
  });
  if (time !== undefined)
    Object.defineProperty(event, "timeStamp", { value: time });
  fireEvent(element, event);
}
it("keeps body subscriptions and a drag alive across rerenders, calling the latest action", () => {
  const first = vi.fn(),
    latest = vi.fn();
  const { getByTestId, rerender } = render(<Sheet onAction={first} />);
  const body = getByTestId("body"),
    panel = body.parentElement!;
  const remove = vi.spyOn(body, "removeEventListener");
  touch(body, "touchstart", 0);
  touch(body, "touchmove", 10);
  touch(body, "touchmove", 50);
  expect(panel.style.transform).toBe("translateY(50px)");
  rerender(<Sheet collapsed onAction={latest} />);
  expect(remove).not.toHaveBeenCalled();
  touch(body, "touchmove", 110);
  expect(panel.style.transform).toBe("translateY(110px)");
  touch(body, "touchend", 110);
  expect(first).not.toHaveBeenCalled();
  expect(latest).toHaveBeenCalledWith("close");
});
it("cancels the drag and detaches listeners when the body changes or unmounts", () => {
  const onAction = vi.fn();
  const { getByTestId, rerender, unmount } = render(
    <Sheet onAction={onAction} />,
  );
  const body = getByTestId("body");
  const remove = vi.spyOn(body, "removeEventListener");
  touch(body, "touchstart", 0);
  touch(body, "touchmove", 10);
  touch(body, "touchmove", 50);
  touch(body, "touchcancel", 50);
  // Back to the summary's stop, held in pixels until the motion has ended.
  expect(body.parentElement!.style.transform).toBe("translateY(625px)");
  expect(body.parentElement!.style.transition).toBe(
    "transform 280ms cubic-bezier(0.2, 0.8, 0.2, 1)",
  );
  expect(onAction).toHaveBeenCalledWith("stay");
  rerender(<Sheet onAction={onAction} bodyKey="other" />);
  expect(remove).toHaveBeenCalledTimes(4);
  unmount();
  expect(remove).toHaveBeenCalledTimes(8);
});

it("swipes upward from the summary body and downward only at the top of full content", () => {
  const onAction = vi.fn();
  function Body({ state }: { state: "summary" | "full" }) {
    const panel = useRef<HTMLElement>(null);
    useSheetDrag({
      panelRef: panel,
      state,
      bodyKey: "same",
      getAnchors: () => ({ full: 0, summary: 625, collapsed: 827 }),
      onAction,
    });
    return (
      <main className="explorer">
        <section ref={panel}>
          <div className="detail-body" data-testid="scroll-body" />
        </section>
      </main>
    );
  }
  const { getByTestId, rerender } = render(<Body state="summary" />);
  const body = getByTestId("scroll-body");
  touch(body, "touchstart", 200);
  touch(body, "touchmove", 190);
  touch(body, "touchmove", 90);
  touch(body, "touchend", 90);
  expect(onAction).toHaveBeenLastCalledWith("full");
  rerender(<Body state="full" />);
  onAction.mockClear();
  body.scrollTop = 30;
  touch(body, "touchstart", 0);
  touch(body, "touchmove", 10);
  touch(body, "touchmove", 110);
  touch(body, "touchend", 110);
  expect(onAction).not.toHaveBeenCalled();
  body.scrollTop = 0;
  touch(body, "touchstart", 0, 0);
  touch(body, "touchmove", 10, 100);
  touch(body, "touchmove", 110, 300);
  touch(body, "touchend", 110, 450);
  expect(onAction).toHaveBeenLastCalledWith("summary");
});

function pointer(handle: HTMLElement, type: string, y: number, time: number) {
  const event = new MouseEvent(type, { bubbles: true, clientY: y, button: 0 });
  Object.defineProperties(event, {
    pointerId: { value: 1 },
    timeStamp: { value: time },
  });
  fireEvent(handle, event);
}
/** Reads `translateY(<n>px)`; anything else is the folded sheet at 827px. */
function stubMatrix() {
  vi.stubGlobal(
    "DOMMatrixReadOnly",
    class {
      m42: number;
      constructor(transform?: string) {
        const y = /translateY\((-?[\d.]+)px\)/.exec(transform ?? "");
        this.m42 = y ? Number(y[1]) : 827;
      }
    },
  );
}
it("carries the locate button and the credit with the sheet and lands them together", () => {
  stubMatrix();
  const onAction = vi.fn();
  const { getByTestId } = render(<Sheet collapsed onAction={onAction} />);
  const handle = getByTestId("handle");
  handle.setPointerCapture = vi.fn();
  const panel = handle.parentElement!;
  const locate = getByTestId("locate"),
    credit = getByTestId("credit");
  // Folded, they rest 44px up.
  locate.style.transform = credit.style.transform = "translateY(-44px)";
  pointer(handle, "pointerdown", 800, 0);
  pointer(handle, "pointermove", 740, 20);
  // 60px above the folded stop, they ride 60px above their folded place.
  expect(locate.style.transform).toBe("translateY(-104px)");
  expect(credit.style.transform).toBe(locate.style.transform);
  expect(locate.style.transition).toBe("none");
  pointer(handle, "pointermove", 500, 40);
  // Past the summary they stop at the summary's height, as in full view.
  expect(locate.style.transform).toBe("translateY(-246px)");
  pointer(handle, "pointerup", 500, 40);
  expect(onAction).toHaveBeenLastCalledWith("full");
  // The sheet heads for its stop without waiting for the new state, and the
  // controls return to the CSS of that state over the same motion.
  expect(panel.style.transform).toBe("translateY(0px)");
  const [, duration] = /^transform (\d+ms) /.exec(panel.style.transition)!;
  expect(locate.style.transform).toBe("");
  expect(locate.style.transitionDuration).toBe(duration);
  expect(credit.style.transitionDuration).toBe(duration);
  expect(locate.style.transitionTimingFunction).toBe(
    panel.style.transition.slice(`transform ${duration} `.length),
  );
});

it("holds the controls where they are when the moving sheet is caught again", () => {
  stubMatrix();
  const onAction = vi.fn();
  const { getByTestId } = render(<Sheet collapsed onAction={onAction} />);
  const handle = getByTestId("handle");
  handle.setPointerCapture = vi.fn();
  const panel = handle.parentElement!;
  const locate = getByTestId("locate");
  // Halfway up to the summary, with the controls halfway too: only their
  // computed style says so, while their transitions run.
  vi.spyOn(window, "getComputedStyle").mockImplementation(
    (element) =>
      ({
        transform:
          element === panel
            ? "translateY(700px)"
            : element === locate
              ? "translateY(-170px)"
              : "none",
      }) as CSSStyleDeclaration,
  );
  pointer(handle, "pointerdown", 700, 0);
  expect(panel.style.transform).toBe("translateY(700px)");
  expect(locate.style.transform).toBe("translateY(-170px)");
  expect(locate.style.transition).toBe("none");
  pointer(handle, "pointermove", 680, 16);
  expect(locate.style.transform).toBe("translateY(-190px)");
});

it.each([
  [100, "full"],
  [101, "summary"],
] as const)(
  "expires release velocity only after 100ms (pause %i)",
  (pause, action) => {
    const onAction = vi.fn();
    vi.stubGlobal(
      "DOMMatrixReadOnly",
      class {
        m42 = 827;
      },
    );
    const { getByTestId } = render(<Sheet collapsed onAction={onAction} />);
    const handle = getByTestId("handle");
    handle.setPointerCapture = vi.fn();
    pointer(handle, "pointerdown", 800, 0);
    pointer(handle, "pointermove", 740, 10);
    pointer(handle, "pointerup", 740, 10 + pause);
    expect(onAction).toHaveBeenLastCalledWith(action);
  },
);

it("settles a skipped level immediately with reduced motion", () => {
  vi.stubGlobal("matchMedia", () => ({ matches: true }));
  vi.stubGlobal(
    "DOMMatrixReadOnly",
    class {
      m42 = 827;
    },
  );
  const onAction = vi.fn();
  const { getByTestId } = render(<Sheet collapsed onAction={onAction} />);
  const body = getByTestId("body");
  touch(body, "touchstart", 800, 0);
  touch(body, "touchmove", 790, 10);
  touch(body, "touchmove", 500, 30);
  touch(body, "touchend", 500, 31);
  expect(onAction).toHaveBeenLastCalledWith("full");
  expect(body.parentElement!.style.transition).toBe("none");
  expect(body.parentElement!.style.transform).toBe("");
});
