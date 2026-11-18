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
// One card chosen, with nothing else to show or report.
const detail: Parameters<typeof useDetailSheet>[1] = {
  clearSelection: vi.fn(),
  searchDetail: false,
  dismissCard: vi.fn(),
  cardId: null,
  issues: [],
  closeCard: vi.fn(),
  selection: { ids: ["card"], started: 0 },
  show: vi.fn(),
  selectCard: vi.fn(),
  cards: new Map(),
};
function Sheet({ of = detail }: { of?: typeof detail }) {
  const root = useRef<HTMLElement>(null);
  const sheet = useDetailSheet(root, of);
  return (
    <main ref={root}>
      <div data-testid="map" />
      <section
        className={`detail-panel is-${sheet.sheetState}`}
        ref={sheet.detailRef}
        data-testid="panel"
        data-state={sheet.sheetState}
        data-full={sheet.layoutFull}
        data-opening={sheet.opening}
      >
        <button type="button" className="detail-close">
          閉じる
        </button>
        <div className="detail-body">
          <h2 tabIndex={-1}>カード</h2>
          <div className="sheet-extra">
            <section className="record-editor">
              <h3 className="record-title" tabIndex={-1}>
                入手の記録
              </h3>
            </section>
          </div>
          <button type="button" onClick={() => sheet.expandSheet("record")}>
            印
          </button>
        </div>
        <button
          type="button"
          className="sheet-more"
          onClick={() => sheet.expandSheet()}
        >
          詳しく
        </button>
      </section>
      <button type="button" onClick={sheet.collapseSheet}>
        たたむ
      </button>
      <button type="button" onClick={sheet.finishMotion}>
        動作完了
      </button>
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
  expect(detail.clearSelection).not.toHaveBeenCalled();
  expect(document.activeElement).toBe(close);
  // Forward restores full; a normal browser Back still restores the summary.
  act(() => history.forward());
  await waitFor(() => expect(panel.dataset.state).toBe("full"));
  act(() => history.back());
  await waitFor(() => expect(panel.dataset.state).toBe("summary"));
});

it("starts another card with the summary, free of what a drag left on the panel", () => {
  const { getByTestId, getByText, rerender } = render(<Sheet />);
  const panel = getByTestId("panel");
  fireEvent.click(getByText("たたむ"));
  expect(panel.dataset.state).toBe("collapsed");
  expect(panel.dataset.opening).toBe("false");
  // As a released drag holds it (use-sheet-drag), its motion not yet ended.
  panel.setAttribute("data-sheet-stop", "collapsed");
  panel.setAttribute("data-sheet-moving", "");
  panel.style.transform = "translateY(827px)";

  // Reached without a press on this page, as by a back to another card.
  rerender(<Sheet of={{ ...detail, cardId: "other" }} />);
  expect(panel.dataset.state).toBe("summary");
  expect(panel.dataset.opening).toBe("true");
  expect(panel.dataset.full).toBe("false");
  expect(panel.hasAttribute("data-sheet-stop")).toBe(false);
  expect(panel.hasAttribute("data-sheet-moving")).toBe(false);
  expect(panel.style.transform).toBe("");

  // The cards themselves replaced, as when the data arrives.
  fireEvent.click(getByText("たたむ"));
  rerender(<Sheet of={{ ...detail, cardId: "other", cards: new Map() }} />);
  expect(panel.dataset.state).toBe("summary");
});
it("focuses the record heading after opening the full sheet from the stamp", () => {
  const { getByText } = render(<Sheet />);
  fireEvent.click(getByText("印"));
  fireEvent.click(getByText("動作完了"));
  expect(document.activeElement).toBe(getByText("入手の記録"));
});

it("opens a folded sheet with the opening motion when it is swiped to the summary", () => {
  const { getByTestId, getByText } = render(<Sheet />);
  const panel = getByTestId("panel");
  fireEvent.click(getByText("たたむ"));
  expect(panel.dataset.opening).toBe("false");
  act(() => drag.options!.onAction("summary"));
  expect(panel.dataset.state).toBe("summary");
  expect(panel.dataset.opening).toBe("true");
});

/** What use-sheet-drag leaves on a released sheet heading for `stop`. */
function hold(panel: HTMLElement, stop: string, from: string, y: number) {
  panel.setAttribute("data-sheet-moving", "");
  panel.setAttribute("data-sheet-stop", stop);
  panel.setAttribute("data-sheet-from", from);
  panel.style.transform = `translateY(${y}px)`;
  panel.style.transition = "transform 200ms ease";
}
it("holds the stop while the history answers, then hands it back to the CSS without a second motion", async () => {
  const frames: FrameRequestCallback[] = [];
  vi.stubGlobal("requestAnimationFrame", (frame: FrameRequestCallback) =>
    frames.push(frame),
  );
  const { getByTestId, getByText } = render(<Sheet />);
  const panel = getByTestId("panel");
  act(() => drag.options!.onAction("full"));
  fireEvent.click(getByText("動作完了"));
  // Swiped down from full view: the summary comes with the history's answer.
  hold(panel, "summary", "full", 625);
  act(() => drag.options!.onAction("summary"));
  fireEvent.click(getByText("動作完了"));
  expect(panel.dataset.state).toBe("full");
  expect(panel.style.transform).toBe("translateY(625px)");
  await waitFor(() => expect(panel.dataset.state).toBe("summary"));
  fireEvent.click(getByText("動作完了"));
  expect(panel.hasAttribute("data-sheet-stop")).toBe(false);
  expect(panel.style.transform).toBe("");
  expect(panel.style.transition).toBe("none");
  frames.forEach((frame) => frame(0));
  expect(panel.style.transition).toBe("");
});

it.each([
  ["a map tap folds it", "たたむ", "collapsed"],
  ["the full view opens", "詳しく", "full"],
] as const)(
  "lets go of a landing that a later step replaces: %s",
  (_, control, state) => {
    const { getByTestId, getByText } = render(<Sheet />);
    const panel = getByTestId("panel");
    fireEvent.click(getByText("たたむ"));
    // Swiped up from folded, still on the way to the summary.
    hold(panel, "summary", "collapsed", 625);
    act(() => drag.options!.onAction("summary"));
    expect(panel.style.transform).toBe("translateY(625px)");
    fireEvent.click(getByText(control));
    expect(panel.dataset.state).toBe(state);
    // The new state's CSS moves it on from where it is.
    expect(panel.hasAttribute("data-sheet-stop")).toBe(false);
    expect(panel.style.transform).toBe("");
    expect(panel.style.transition).toBe("");
    fireEvent.click(getByText("動作完了"));
    fireEvent.click(getByText("動作完了"));
    expect(panel.style.transform).toBe("");
  },
);

it("closes the selection after Back leaves the full sheet", async () => {
  const clearSelection = vi.fn();
  const { getByText, getByTestId } = render(
    <Sheet of={{ ...detail, clearSelection }} />,
  );
  fireEvent.click(getByText("詳しく"));
  act(() => drag.options!.onAction("close"));
  expect(clearSelection).not.toHaveBeenCalled();
  await waitFor(() => expect(clearSelection).toHaveBeenCalledTimes(1));
  expect(getByTestId("panel").dataset.state).toBe("summary");
});
