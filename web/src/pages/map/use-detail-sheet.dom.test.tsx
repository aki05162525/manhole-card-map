import {
  act,
  cleanup,
  fireEvent,
  render,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useRef } from "react";
import { useDetailSheet } from "./use-detail-sheet";
import type { useSheetDrag } from "./use-sheet-drag";

const drag = vi.hoisted(() => ({
  options: null as Parameters<typeof useSheetDrag>[0] | null,
}));
vi.mock("./use-sheet-drag", () => ({
  useSheetDrag: (options: Parameters<typeof useSheetDrag>[0]) => {
    drag.options = options;
    return {};
  },
}));
const detail = {
  setRevealedLid: vi.fn(),
  setSelection: vi.fn(),
  issues: [],
  cards: [],
  selection: { ids: ["card"] },
} as unknown as Parameters<typeof useDetailSheet>[1];
function Sheet() {
  const root = useRef<HTMLElement>(null);
  const sheet = useDetailSheet(root, detail);
  return (
    <main ref={root}>
      <div data-testid="map" />
      <section
        className={`detail-panel is-${sheet.sheetState}`}
        ref={sheet.detailRef}
        data-testid="panel"
        data-state={sheet.sheetState}
        data-full={sheet.layoutFull}
      >
        <button className="detail-close">閉じる</button>
        <div className="detail-body">
          <h2 tabIndex={-1}>カード</h2>
          <div className="sheet-extra" />
        </div>
        <button className="sheet-more" onClick={() => sheet.expandSheet()}>
          詳しく
        </button>
      </section>
      <button onClick={sheet.collapseSheet}>たたむ</button>
      <button onClick={sheet.finishMotion}>動作完了</button>
    </main>
  );
}
beforeEach(() => {
  history.replaceState({ card: "card" }, "", "/?card=card");
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(412);
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(915);
  vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(915);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it("measures the stored summary and peek heights including the bottom inset", () => {
  const { getByTestId } = render(<Sheet />);
  const panel = getByTestId("panel");
  panel.style.setProperty("--sheet-summary-height", "290px");
  panel.style.setProperty("--sheet-peek-height", "80px");
  panel.style.paddingBottom = "8px";
  expect(drag.options!.getAnchors()).toEqual({
    full: 0,
    summary: 625,
    collapsed: 827,
  });
});
it("flings between collapsed and full with one history entry and deferred inert/focus", async () => {
  const { getByTestId, getByText } = render(<Sheet />);
  const panel = getByTestId("panel"),
    map = getByTestId("map");
  const close = getByText("閉じる");
  fireEvent.click(getByText("たたむ"));
  close.focus();
  const push = vi.spyOn(history, "pushState"),
    back = vi.spyOn(history, "back");
  act(() => drag.options!.onAction("full"));
  expect(panel.dataset.state).toBe("full");
  expect(push).toHaveBeenCalledTimes(1);
  expect(history.state).toMatchObject({ sheet: "full", card: "card" });
  expect(map.hasAttribute("inert")).toBe(false);
  expect(document.activeElement).toBe(close);
  fireEvent.click(getByText("動作完了"));
  expect(map.hasAttribute("inert")).toBe(true);
  expect(document.activeElement).toBe(getByText("カード"));
  act(() => drag.options!.onAction("collapsed"));
  expect(back).toHaveBeenCalledTimes(1);
  await waitFor(() => expect(panel.dataset.state).toBe("collapsed"));
  expect(history.state).toEqual({ card: "card" });
  expect(push).toHaveBeenCalledTimes(1);
  expect(map.hasAttribute("inert")).toBe(true);
  fireEvent.click(getByText("動作完了"));
  expect(map.hasAttribute("inert")).toBe(false);
  expect(detail.setSelection).not.toHaveBeenCalled();
  expect(document.activeElement).toBe(close);
  // Forward restores full; a normal browser Back still restores the summary.
  act(() => history.forward());
  await waitFor(() => expect(panel.dataset.state).toBe("full"));
  act(() => history.back());
  await waitFor(() => expect(panel.dataset.state).toBe("summary"));
});
