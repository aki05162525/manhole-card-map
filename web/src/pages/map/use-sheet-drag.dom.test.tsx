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
    panel,
    state: collapsed ? "collapsed" : "summary",
    bodyKey,
    onAction,
  });
  return (
    <main className="explorer">
      <section ref={panel}>
        <div data-testid="handle" {...handlers} />
        <div className="detail-body" data-testid="body" />
      </section>
    </main>
  );
}
function touch(element: HTMLElement, type: string, y: number) {
  fireEvent(
    element,
    new TouchEvent(type, {
      bubbles: true,
      cancelable: true,
      touches: [{ clientY: y } as Touch],
      changedTouches: [{ clientY: y } as Touch],
    }),
  );
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
  expect(body.parentElement!.style.transform).toBe("");
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
    useSheetDrag({ panel, state, bodyKey: "same", onAction });
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
  touch(body, "touchstart", 0);
  touch(body, "touchmove", 10);
  touch(body, "touchmove", 110);
  touch(body, "touchend", 110);
  expect(onAction).toHaveBeenLastCalledWith("summary");
});
