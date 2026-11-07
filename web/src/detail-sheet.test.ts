import { expect, it } from "vitest";
import { dismissSheet, sheetPadding } from "./detail-sheet";
it("dismisses by downward distance or release velocity only", () => {
  expect(dismissSheet(80, 0)).toBe(true);
  expect(dismissSheet(12, 0.5)).toBe(true);
  expect(dismissSheet(79, 0.49)).toBe(false);
  expect(dismissSheet(-90, 1)).toBe(false);
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
