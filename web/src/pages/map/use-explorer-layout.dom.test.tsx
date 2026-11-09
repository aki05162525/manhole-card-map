import { cleanup, render } from "@testing-library/react";
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
    "read:detail-actions",
    "read:safe-area",
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
