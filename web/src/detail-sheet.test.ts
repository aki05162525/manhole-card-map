import { expect, it } from "vitest";
import {
  sheetAfterSwipe,
  sheetDragOffset,
  sheetPadding,
  smoothedVelocity,
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
it("follows the finger in both directions without passing the open position", () => {
  expect(sheetDragOffset(0, 30)).toBe(30);
  expect(sheetDragOffset(320, -120)).toBe(200);
  expect(sheetDragOffset(320, 60)).toBe(380);
  expect(sheetDragOffset(0, -40)).toBe(0);
  expect(sheetDragOffset(100, -400)).toBe(0);
});
it("smooths release velocity so one noisy sample does not decide the swipe", () => {
  expect(smoothedVelocity(0, 10, 10)).toBeCloseTo(0.6);
  expect(smoothedVelocity(1, 0, 16)).toBeCloseTo(0.4);
  expect(smoothedVelocity(0.5, 8, 0)).toBeGreaterThan(0.5);
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
