import { readFileSync } from "node:fs";
import { afterEach, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { SiteHeader } from "./site-header";

afterEach(() => {
  cleanup();
  document.head.replaceChildren();
});
it.each(["cards", "about", undefined] as const)(
  "帯はページのリセットや行送りに依存しない: %s",
  (current) => {
    const style = document.createElement("style");
    style.textContent = readFileSync("src/shared/ui/site-header.css", "utf8");
    document.head.append(style);
    const globalStyle = document.createElement("style");
    document.head.prepend(globalStyle);
    const { container } = render(<SiteHeader current={current} />);
    const measure = () =>
      [
        ...container.querySelectorAll(
          ".site-header, .site-header-inner, .site-brand, nav a",
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
    expect(minimal.every((css) => css.boxSizing === "border-box")).toBe(true);
    expect(minimal[1]?.lineHeight).toBe("24px");
    expect(minimal[3]?.lineHeight).toBe("24px");
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
    expect(getComputedStyle(wordmark).display).not.toBe("none");
  },
);
