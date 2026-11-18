import { cleanup, render } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import type { Status } from "../../domain/types";
import { StatusChip } from "./status-chip";

afterEach(cleanup);

// The square tells the statuses apart without the colour.
it.each<[Status, string, "filled" | "half" | "outline"]>([
  ["active", "配布中", "filled"],
  ["upcoming", "配布予定", "filled"],
  ["suspended", "一時中止", "half"],
  ["ended", "終了", "outline"],
  ["unknown", "未確認", "outline"],
])("names %s as %s beside a %s square", (status, label, square) => {
  const chip = render(<StatusChip status={status} />).container
    .firstElementChild;
  expect(chip?.classList.contains(`status-chip-${status}`)).toBe(true);
  expect(chip?.textContent).toBe(label);
  expect(chip?.querySelector("svg rect")?.getAttribute("fill")).toBe(
    square === "filled" ? "currentColor" : "none",
  );
  expect(chip?.querySelector("svg path") !== null).toBe(square === "half");
});
