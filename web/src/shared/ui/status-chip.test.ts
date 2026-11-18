import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import type { Status } from "../../domain/types";
import { StatusChip } from "./status-chip";

// The square tells the statuses apart without the colour.
it.each<[Status, string, "filled" | "half" | "outline"]>([
  ["active", "配布中", "filled"],
  ["upcoming", "配布予定", "filled"],
  ["suspended", "一時中止", "half"],
  ["ended", "終了", "outline"],
  ["unknown", "未確認", "outline"],
])("names %s as %s beside a %s square", (status, label, square) => {
  const html = renderToStaticMarkup(createElement(StatusChip, { status }));
  expect(html).toMatch(new RegExp(`class="[^"]*status-chip-${status}"`));
  expect(html.endsWith(`</svg>${label}</span>`)).toBe(true);
  expect(/<rect[^>]* fill="(\w+)"/.exec(html)?.[1]).toBe(
    square === "filled" ? "currentColor" : "none",
  );
  expect(html.includes("<path")).toBe(square === "half");
});
