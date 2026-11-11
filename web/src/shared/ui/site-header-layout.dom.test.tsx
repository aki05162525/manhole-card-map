import { readFileSync } from "node:fs";
import { afterEach, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { SiteHeader } from "./site-header";

afterEach(() => {
  cleanup();
  document.head.replaceChildren();
});
it.each(["cards", "about", undefined] as const)(
  "帯はページのリセットや行送りに依存しない: %s",
  (current) => {
    const style = document.createElement("style");
    style.textContent =
      readFileSync("src/shared/ui/site-header.css", "utf8") +
      readFileSync("src/shared/ui/site-menu.css", "utf8");
    document.head.append(style);
    const globalStyle = document.createElement("style");
    document.head.prepend(globalStyle);
    const { container } = render(<SiteHeader current={current} />);
    fireEvent.click(screen.getByRole("button", { name: "メニュー" }));
    const measure = () =>
      [
        ...container.querySelectorAll(
          ".site-header, .site-header-inner, .site-brand, .site-nav-links a, .site-menu, .site-menu-button, .site-menu-panel, .site-menu-panel a",
        ),
      ].map((node) => {
        const css = getComputedStyle(node);
        return {
          boxSizing: css.boxSizing,
          lineHeight: css.lineHeight,
          minHeight: css.minHeight,
          maxWidth: css.maxWidth,
          padding: css.padding,
        };
      });
    const minimal = measure();
    globalStyle.textContent =
      "* { box-sizing: content-box } body, a { line-height: 3 }";
    expect(measure()).toEqual(minimal);
    globalStyle.textContent =
      "* { box-sizing: border-box } body, a { line-height: 1 }";
    expect(measure()).toEqual(minimal);
    const wordmark = container.querySelector(".wordmark")!;
    expect(wordmark).toBeTruthy();
    expect(getComputedStyle(wordmark).opacity).toBe(
      current === "about" ? "0" : "1",
    );
  },
);
