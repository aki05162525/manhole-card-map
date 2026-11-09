import { expect, it } from "vitest";
import {
  sheetAfterSwipe,
  sheetDragOffset,
  sheetPadding,
  smoothedVelocity,
} from "./detail-sheet";
const anchors = { full: 0, summary: 625, collapsed: 827 };
it.each([
  ["collapsed", -100, "summary"],
  ["summary", -100, "full"],
  ["full", -100, "stay"],
  ["collapsed", 100, "close"],
  ["summary", 100, "collapsed"],
  ["full", 100, "summary"],
] as const)("moves %s one step after a %i swipe", (state, distance, action) => {
  expect(sheetAfterSwipe(state, distance, 0, anchors)).toBe(action);
});
it.each(["collapsed", "summary", "full"] as const)(
  "keeps %s on short drags",
  (state) => {
    expect(sheetAfterSwipe(state, 20, 0, anchors)).toBe("stay");
    expect(sheetAfterSwipe(state, -20, 0, anchors)).toBe("stay");
  },
);
it("opens one step on a handle tap and honors release velocity", () => {
  expect(sheetAfterSwipe("collapsed", 0, 0, anchors)).toBe("summary");
  expect(sheetAfterSwipe("summary", 0, 0, anchors)).toBe("full");
  expect(sheetAfterSwipe("full", 0, 0, anchors)).toBe("stay");
  expect(sheetAfterSwipe("summary", -12, -0.5, anchors)).toBe("full");
  expect(sheetAfterSwipe("full", 12, 0.5, anchors)).toBe("summary");
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

it.each([
  ["collapsed", -60, -2.5, "full"],
  ["collapsed", -60, -1, "summary"],
  ["collapsed", -10, -4, "summary"],
  ["full", 100, 4, "collapsed"],
  ["full", 100, 2.5, "summary"],
  ["summary", 100, 4, "collapsed"],
  ["collapsed", 40, 0, "close"],
] as const)(
  "projects %s at distance %i and velocity %i to %s",
  (state, distance, velocity, target) => {
    expect(sheetAfterSwipe(state, distance, velocity, anchors)).toBe(target);
  },
);
it("caps projection velocity in both directions", () => {
  const tall = { full: 0, summary: 1300, collapsed: 1900 };
  expect(sheetAfterSwipe("full", 100, 10, tall)).toBe(
    sheetAfterSwipe("full", 100, 4, tall),
  );
  expect(sheetAfterSwipe("collapsed", -100, -10, tall)).toBe(
    sheetAfterSwipe("collapsed", -100, -4, tall),
  );
});
it("uses measured anchors and the actual release position", () => {
  expect(
    sheetAfterSwipe("collapsed", -60, -2.5, {
      full: 0,
      summary: 100,
      collapsed: 1000,
    }),
  ).toBe("summary");
  expect(sheetAfterSwipe("collapsed", -60, -1, anchors, 100)).toBe("full");
});
it("also projects gestures below the old one-step minimum", () => {
  expect(sheetAfterSwipe("collapsed", -35, -0.49, anchors)).toBe("summary");
  expect(sheetAfterSwipe("collapsed", -24, -0.1, anchors)).toBe("stay");
});
