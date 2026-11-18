import { act, cleanup, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useRef } from "react";
import { useExplorerLayout } from "./use-explorer-layout";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it("reads sheet dimensions and safe area before writing CSS variables", () => {
  const operations: string[] = [];
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(
    function (this: HTMLElement) {
      operations.push(`read:${this.className}`);
      return this.className === "detail-actions" ? 40 : 200;
    },
  );
  vi.spyOn(window, "getComputedStyle").mockImplementation(() => {
    operations.push("read:safe-area");
    return { paddingBottom: "10px" } as CSSStyleDeclaration;
  });
  const setProperty = CSSStyleDeclaration.prototype.setProperty;
  vi.spyOn(CSSStyleDeclaration.prototype, "setProperty").mockImplementation(
    function (this: CSSStyleDeclaration, name, value, priority) {
      if (name === "--sheet-peek-height" || name === "--detail-sheet-height")
        operations.push(`write:${name}`);
      setProperty.call(this, name, value, priority);
    },
  );
  function Layout({ collapsed }: { collapsed: boolean }) {
    const root = useRef<HTMLElement>(null),
      detail = useRef<HTMLElement>(null);
    useExplorerLayout(
      root,
      detail,
      "card",
      false,
      collapsed ? "collapsed" : "summary",
    );
    return (
      <main ref={root}>
        <header className="map-search-bar" />
        <div className="map-notices" />
        <div className="map-stage" />
        <section ref={detail}>
          <div className="detail-actions" />
        </section>
        <button type="button" id="locate" aria-label="現在地" />
      </main>
    );
  }
  const { container, rerender } = render(<Layout collapsed={false} />);
  expect(operations).toEqual([
    "read:safe-area",
    "read:detail-actions",
    "read:detail-actions",
    "read:",
    "write:--sheet-peek-height",
    "write:--detail-sheet-height",
    "write:--detail-sheet-height",
  ]);
  // Only what rides above the sheet takes its height: a change on the root
  // would restyle the whole page, the sheet's content included.
  const lifted = (selector: string) =>
    container
      .querySelector<HTMLElement>(selector)!
      .style.getPropertyValue("--detail-sheet-height");
  expect(lifted("main")).toBe("");
  expect(lifted("#locate")).toBe("200px");
  expect(lifted(".map-stage")).toBe("200px");
  rerender(<Layout collapsed />);
  expect(lifted("#locate")).toBe("50px");
  expect(lifted(".map-stage")).toBe("50px");
});

it("shortens the summary by steps while its current stop is clipped, and remeasures after collapse", () => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  // The stop's content is 120px, then 100px, then 70px as the levels are
  // applied; `room` is what the summary's CSS leaves it.
  let room = 70;
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockImplementation(
    function (this: HTMLElement) {
      return this.className === "route-stop is-current" ? room : 915;
    },
  );
  vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockImplementation(
    function (this: HTMLElement) {
      const panel = this.closest("section");
      return panel?.hasAttribute("data-sheet-imageless")
        ? 50
        : panel?.hasAttribute("data-sheet-bare")
          ? 70
          : panel?.hasAttribute("data-sheet-tight")
            ? 90
            : panel?.hasAttribute("data-sheet-compact")
              ? 100
              : 120;
    },
  );
  vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(
    function (this: HTMLElement) {
      if (this.className === "detail-actions") return 44;
      if (this.className === "sheet-summary")
        return this.closest("section")?.classList.contains("is-collapsed")
          ? 520
          : 250;
      return 915;
    },
  );
  function Layout({ collapsed }: { collapsed: boolean }) {
    const root = useRef<HTMLElement>(null),
      detail = useRef<HTMLElement>(null);
    useExplorerLayout(
      root,
      detail,
      "card",
      false,
      collapsed ? "collapsed" : "summary",
    );
    return (
      <main ref={root}>
        <section
          ref={detail}
          className={collapsed ? "is-collapsed" : "is-summary"}
        >
          <div className="detail-actions" />
          <div className="sheet-summary">
            <div className="route-stop is-current" />
          </div>
        </section>
      </main>
    );
  }
  const { container, rerender, unmount } = render(<Layout collapsed={false} />);
  const panel = container.querySelector("section")!;
  expect(panel.hasAttribute("data-sheet-tight")).toBe(true);
  expect(panel.hasAttribute("data-sheet-bare")).toBe(true);
  // The card's image stays in the summary while the text alone can give way.
  expect(panel.hasAttribute("data-sheet-imageless")).toBe(false);
  const height = panel.style.getPropertyValue("--sheet-summary-height");
  expect(height).toBe("310px");
  rerender(<Layout collapsed />);
  expect(panel.style.getPropertyValue("--sheet-summary-height")).toBe(height);
  rerender(<Layout collapsed={false} />);
  expect(panel.style.getPropertyValue("--sheet-summary-height")).toBe(height);
  unmount();
  // Room for one line each: the first level is enough.
  room = 100;
  const roomy = render(<Layout collapsed={false} />).container.querySelector(
    "section",
  )!;
  expect(roomy.hasAttribute("data-sheet-compact")).toBe(true);
  expect(roomy.hasAttribute("data-sheet-tight")).toBe(false);
  expect(roomy.hasAttribute("data-sheet-bare")).toBe(false);
  cleanup();
  // No level of text fits: the image waits for the full view.
  room = 50;
  expect(
    render(<Layout collapsed={false} />)
      .container.querySelector("section")!
      .hasAttribute("data-sheet-imageless"),
  ).toBe(true);
});

it("preserves measured padding during dragging and transform transitions", () => {
  const callbacks: ResizeObserverCallback[] = [];
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback: ResizeObserverCallback) {
        callbacks.push(callback);
      }
      observe() {}
      disconnect() {}
    },
  );
  function Layout({ moving = false }: { moving?: boolean }) {
    const root = useRef<HTMLElement>(null),
      detail = useRef<HTMLElement>(null);
    useExplorerLayout(root, detail, "card", false, moving ? "full" : "summary");
    return (
      <main ref={root}>
        <section ref={detail} data-sheet-moving={moving ? "" : undefined}>
          <div className="detail-actions" />
        </section>
        <button type="button" id="locate" aria-label="現在地" />
      </main>
    );
  }
  const { container, rerender } = render(<Layout />);
  const locate = container.querySelector<HTMLElement>("#locate")!;
  const panel = container.querySelector("section")!;
  const height = locate.style.getPropertyValue("--detail-sheet-height");
  const writes = vi.spyOn(CSSStyleDeclaration.prototype, "setProperty");
  panel.classList.add("is-dragging");
  act(() => callbacks[0]([], {} as ResizeObserver));
  expect(writes).not.toHaveBeenCalled();
  panel.classList.remove("is-dragging");
  rerender(<Layout moving />);
  act(() => callbacks.at(-1)!([], {} as ResizeObserver));
  expect(writes).not.toHaveBeenCalled();
  expect(locate.style.getPropertyValue("--detail-sheet-height")).toBe(height);
});

it("lifts the map controls to a new stop as the sheet starts moving there, from the stored heights", () => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.spyOn(window, "getComputedStyle").mockImplementation(
    () => ({ paddingBottom: "10px" }) as CSSStyleDeclaration,
  );
  const reads = vi
    .spyOn(HTMLElement.prototype, "offsetHeight", "get")
    .mockImplementation(function (this: HTMLElement) {
      return this.className === "detail-actions" ? 44 : 300;
    });
  function Layout({ state }: { state: "summary" | "collapsed" }) {
    const root = useRef<HTMLElement>(null),
      detail = useRef<HTMLElement>(null);
    useExplorerLayout(root, detail, "card", false, state);
    return (
      <main ref={root}>
        <section
          ref={detail}
          data-sheet-moving={state === "collapsed" ? "" : undefined}
        >
          <div className="detail-actions" />
          <div className="sheet-summary">
            <div className="route-stop is-current" />
          </div>
        </section>
        <button type="button" id="locate" aria-label="現在地" />
      </main>
    );
  }
  const { container, rerender } = render(<Layout state="summary" />);
  const locate = container.querySelector<HTMLElement>("#locate")!;
  const panel = container.querySelector("section")!;
  const summary = panel.style.getPropertyValue("--sheet-summary-height");
  reads.mockClear();
  rerender(<Layout state="collapsed" />);
  // Not after the motion: the controls travel with the sheet.
  expect(locate.style.getPropertyValue("--detail-sheet-height")).toBe("54px");
  // Nothing is measured again or shortened while the sheet moves.
  expect(reads).not.toHaveBeenCalled();
  expect(panel.style.getPropertyValue("--sheet-summary-height")).toBe(summary);
});

it("includes the external action bar and its safe-area padding in map clearance", () => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(412);
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(915);
  vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(
    function (this: HTMLElement) {
      return (
        (
          {
            "detail-actions": 80,
            "sheet-summary": 180,
            "sheet-action-bar": 107,
          } as Record<string, number>
        )[this.className] ?? 0
      );
    },
  );
  function Layout() {
    const root = useRef<HTMLElement>(null),
      detail = useRef<HTMLElement>(null);
    useExplorerLayout(root, detail, "card", false, "summary");
    return (
      <main ref={root}>
        <section ref={detail}>
          <div className="detail-actions" />
          <div className="sheet-summary" />
        </section>
        <div className="sheet-action-bar" />
        <button type="button" id="locate" aria-label="現在地" />
      </main>
    );
  }
  const { container } = render(<Layout />);
  expect(
    container
      .querySelector("section")!
      .style.getPropertyValue("--sheet-summary-height"),
  ).toBe("383px");
  expect(
    container
      .querySelector<HTMLElement>("#locate")!
      .style.getPropertyValue("--detail-sheet-height"),
  ).toBe("383px");
  expect(
    container
      .querySelector("main")!
      .style.getPropertyValue("--sheet-action-height"),
  ).toBe("107px");
});

it("shows the bar's two-line title whole when collapsed, and keeps the summary to the bar's height", () => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(915);
  vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(
    function (this: HTMLElement) {
      return this.className === "detail-actions"
        ? 44
        : this.className === "sheet-summary"
          ? 250
          : 915;
    },
  );
  // The title is taken out of the bar's flow and runs past its bottom edge.
  vi.spyOn(HTMLElement.prototype, "offsetTop", "get").mockReturnValue(0);
  vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockImplementation(
    function (this: HTMLElement) {
      return this.className === "sheet-bar-title" ? 64 : 0;
    },
  );
  function Layout({ collapsed }: { collapsed: boolean }) {
    const root = useRef<HTMLElement>(null),
      detail = useRef<HTMLElement>(null);
    useExplorerLayout(
      root,
      detail,
      "card",
      false,
      collapsed ? "collapsed" : "summary",
    );
    return (
      <main ref={root}>
        <div className="map-stage" />
        <section ref={detail}>
          <div className="detail-actions">
            <span className="sheet-bar-title" />
          </div>
          <div className="sheet-summary" />
        </section>
      </main>
    );
  }
  const { container, rerender } = render(<Layout collapsed={false} />);
  const panel = container.querySelector("section")!;
  // Known before the sheet folds, so it slides straight to its stop.
  expect(panel.style.getPropertyValue("--sheet-peek-height")).toBe("64px");
  expect(panel.style.getPropertyValue("--sheet-bar-height")).toBe("44px");
  expect(panel.style.getPropertyValue("--sheet-summary-height")).toBe("310px");
  rerender(<Layout collapsed />);
  expect(
    container
      .querySelector<HTMLElement>(".map-stage")!
      .style.getPropertyValue("--detail-sheet-height"),
  ).toBe("64px");
});
