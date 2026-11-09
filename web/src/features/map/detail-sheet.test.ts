import { expect, it } from "vitest";
import {
  sheetAfterSwipe,
  sheetDragOffset,
  sheetPadding,
  smoothedVelocity,
} from "./detail-sheet";
it.each([
  ["collapsed", -100, "summary"],
  ["summary", -100, "full"],
  ["full", -100, "stay"],
  ["collapsed", 100, "close"],
  ["summary", 100, "collapsed"],
  ["full", 100, "summary"],
] as const)("moves %s one step after a %i swipe", (state, distance, action) => {
  expect(sheetAfterSwipe(state, distance, 0)).toBe(action);
});
it.each(["collapsed", "summary", "full"] as const)(
  "keeps %s on short drags",
  (state) => {
    expect(sheetAfterSwipe(state, 20, 0)).toBe("stay");
    expect(sheetAfterSwipe(state, -20, 0)).toBe("stay");
  },
);
it("opens one step on a handle tap and honors release velocity", () => {
  expect(sheetAfterSwipe("collapsed", 0, 0)).toBe("summary");
  expect(sheetAfterSwipe("summary", 0, 0)).toBe("full");
  expect(sheetAfterSwipe("full", 0, 0)).toBe("stay");
  expect(sheetAfterSwipe("summary", -12, -0.5)).toBe("full");
  expect(sheetAfterSwipe("full", 12, 0.5)).toBe("summary");
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
