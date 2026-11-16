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
        <section ref={detail}>
          <div className="detail-actions" />
        </section>
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
  ]);
  expect(
    container
      .querySelector("main")!
      .style.getPropertyValue("--detail-sheet-height"),
  ).toBe("200px");
  rerender(<Layout collapsed />);
  expect(
    container
      .querySelector("main")!
      .style.getPropertyValue("--detail-sheet-height"),
  ).toBe("50px");
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
      return panel?.hasAttribute("data-sheet-bare")
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
      </main>
    );
  }
  const { container, rerender } = render(<Layout />);
  const root = container.querySelector("main")!;
  const panel = container.querySelector("section")!;
  const height = root.style.getPropertyValue("--detail-sheet-height");
  const writes = vi.spyOn(CSSStyleDeclaration.prototype, "setProperty");
  panel.classList.add("is-dragging");
  act(() => callbacks[0]([], {} as ResizeObserver));
  expect(writes).not.toHaveBeenCalled();
  panel.classList.remove("is-dragging");
  rerender(<Layout moving />);
  act(() => callbacks.at(-1)!([], {} as ResizeObserver));
  expect(writes).not.toHaveBeenCalled();
  expect(root.style.getPropertyValue("--detail-sheet-height")).toBe(height);
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
      .querySelector("main")!
      .style.getPropertyValue("--detail-sheet-height"),
  ).toBe("383px");
  expect(
    container
      .querySelector("main")!
      .style.getPropertyValue("--sheet-action-height"),
  ).toBe("107px");
});
