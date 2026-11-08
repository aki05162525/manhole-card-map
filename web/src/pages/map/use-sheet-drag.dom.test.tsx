import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { useRef } from "react";
import { useSheetDrag } from "./use-sheet-drag";

beforeEach(() => {
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
  const handlers = useSheetDrag({ panel, collapsed, bodyKey, onAction });
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
  expect(panel.style.transform).toBe("translateY(40px)");
  rerender(<Sheet collapsed onAction={latest} />);
  expect(remove).not.toHaveBeenCalled();
  touch(body, "touchmove", 110);
  expect(panel.style.transform).toBe("translateY(100px)");
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
  expect(onAction).not.toHaveBeenCalled();
  rerender(<Sheet onAction={onAction} bodyKey="other" />);
  expect(remove).toHaveBeenCalledTimes(4);
  unmount();
  expect(remove).toHaveBeenCalledTimes(8);
});
