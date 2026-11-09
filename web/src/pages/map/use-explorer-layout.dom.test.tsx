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

it("removes notes, then prelude, then a title line while retaining summary hours, and remeasures after collapse", () => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  const measured: string[] = [];
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(915);
  vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(
    function (this: HTMLElement) {
      const panel = this.closest("section");
      if (this.className === "detail-actions")
        return panel?.hasAttribute("data-sheet-without-prelude") ? 20 : 40;
      if (this.className === "sheet-summary") {
        if (panel?.classList.contains("is-collapsed")) return 520;
        const level = panel?.hasAttribute("data-sheet-single-title")
          ? "title"
          : panel?.hasAttribute("data-sheet-without-prelude")
            ? "prelude"
            : panel?.hasAttribute("data-sheet-compact")
              ? "notes"
              : "all";
        measured.push(level);
        return { all: 600, notes: 500, prelude: 450, title: 350 }[level];
      }
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
          <div className="sheet-summary" />
        </section>
      </main>
    );
  }
  const { container, rerender } = render(<Layout collapsed={false} />);
  const panel = container.querySelector("section")!;
  expect(measured.slice(0, 4)).toEqual(["all", "notes", "prelude", "title"]);
  expect(panel.hasAttribute("data-sheet-single-title")).toBe(true);
  const height = panel.style.getPropertyValue("--sheet-summary-height");
  expect(height).toBe("386px");
  rerender(<Layout collapsed />);
  expect(panel.style.getPropertyValue("--sheet-summary-height")).toBe(height);
  rerender(<Layout collapsed={false} />);
  expect(panel.style.getPropertyValue("--sheet-summary-height")).toBe(height);
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
