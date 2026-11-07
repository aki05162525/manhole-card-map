import { expect, it } from "vitest";
import {
  canReturnToPlace,
  sheetAfterSwipe,
  sheetPadding,
} from "./detail-sheet";
it("collapses an open sheet by downward distance or release velocity", () => {
  expect(sheetAfterSwipe(false, 80, 0)).toBe("collapse");
  expect(sheetAfterSwipe(false, 12, 0.5)).toBe("collapse");
  expect(sheetAfterSwipe(false, 79, 0.49)).toBe("stay");
  expect(sheetAfterSwipe(false, -90, -1)).toBe("stay");
  expect(sheetAfterSwipe(false, 0, 0)).toBe("stay");
});
it("reopens a collapsed sheet by tap or upward swipe, and closes it downward", () => {
  expect(sheetAfterSwipe(true, 0, 0)).toBe("expand");
  expect(sheetAfterSwipe(true, -40, 0)).toBe("expand");
  expect(sheetAfterSwipe(true, -12, -0.5)).toBe("expand");
  expect(sheetAfterSwipe(true, 40, 0)).toBe("close");
  expect(sheetAfterSwipe(true, 12, 0.5)).toBe("close");
  expect(sheetAfterSwipe(true, 20, 0)).toBe("stay");
});
it("offers the return to the place for any selection with pins on a ready map", () => {
  expect(canReturnToPlace(1, "ready")).toBe(true);
  expect(canReturnToPlace(0, "ready")).toBe(false);
  expect(canReturnToPlace(1, "failed")).toBe(false);
});
it("centers a single pin at a quarter height within bar and sheet limits", () => {
  const p = sheetPadding(800, 64, 300, 1);
  expect((p.top + 800 - p.bottom) / 2).toBe(200);
  const low = sheetPadding(800, 220, 300, 1);
  expect((low.top + 800 - low.bottom) / 2).toBe(240);
  const high = sheetPadding(800, 64, 650, 1);
  expect((high.top + 800 - high.bottom) / 2).toBe(130);
  expect(sheetPadding(800, 64, 300, 2)).toEqual({ top: 84, bottom: 320 });
});
