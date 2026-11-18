import { expect, it } from "vitest";
import {
  sheetAfterSwipe,
  sheetDragOffset,
  sheetPadding,
  sheetReleaseDuration,
  smoothedVelocity,
} from "./detail-sheet";
const anchors = { full: 0, summary: 625, collapsed: 827 };

it.each([
  // A swipe moves one step.
  ["collapsed", -100, 0, "summary"],
  ["summary", -100, 0, "full"],
  ["full", -100, 0, "stay"],
  ["collapsed", 100, 0, "close"],
  ["summary", 100, 0, "collapsed"],
  ["full", 100, 0, "summary"],
  // A tap on the handle, or a drag under 8px, opens one step.
  ["collapsed", 0, 0, "summary"],
  ["summary", 0, 0, "full"],
  ["full", 0, 0, "stay"],
  ["collapsed", 7, 0, "summary"],
  ["collapsed", -7, 0, "summary"],
  ["collapsed", 8, 0, "stay"],
  ["collapsed", -8, 0, "stay"],
  // Without a distance there is no direction, whatever the last sample says.
  ["summary", 0, 0.5, "full"],
  // A slow drag steps up from 40px, down from 80px, and closes from 40px.
  ["collapsed", -39, 0, "stay"],
  ["collapsed", -40, 0, "summary"],
  ["summary", -39, 0, "stay"],
  ["summary", -40, 0, "full"],
  ["summary", 79, 0, "stay"],
  ["summary", 80, 0, "collapsed"],
  ["full", 79, 0, "stay"],
  ["full", 80, 0, "summary"],
  ["collapsed", 39, 0, "stay"],
  ["collapsed", 40, 0, "close"],
  // A flick of 0.5px/ms steps after any distance, in the drag's direction only.
  ["summary", -12, -0.5, "full"],
  ["summary", -12, -0.49, "stay"],
  ["full", 12, 0.5, "summary"],
  ["full", 12, 0.49, "stay"],
  ["summary", -10, 0.6, "stay"],
  ["summary", 10, -0.6, "stay"],
  // From 24px a release is projected along its velocity, past the next stop
  // when fast enough, but never to closing.
  ["collapsed", -60, -2.5, "full"],
  ["collapsed", -60, -1, "summary"],
  ["collapsed", -10, -4, "summary"],
  ["full", 100, 4, "collapsed"],
  ["full", 100, 2.5, "summary"],
  ["summary", 100, 4, "collapsed"],
  ["collapsed", -35, -0.49, "summary"],
  ["collapsed", -24, -0.45, "summary"],
  ["collapsed", -23, -0.45, "stay"],
  ["collapsed", -24, -0.1, "stay"],
  // Projected exactly half way to the next stop, the sheet stays.
  ["summary", 31, 0.35, "stay"],
] as const)(
  "%s after %spx at %spx/ms: %s",
  (state, distance, velocity, action) => {
    expect(sheetAfterSwipe(state, distance, velocity, anchors)).toBe(action);
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
  const centre = (...args: Parameters<typeof sheetPadding>) => {
    const { top, bottom } = sheetPadding(...args);
    return (top + args[0] - bottom) / 2;
  };
  expect(centre(800, 64, 300, 1)).toBe(200);
  expect(centre(800, 220, 300, 1)).toBe(240);
  expect(centre(800, 64, 650, 1)).toBe(130);
  // Under a bar that leaves less than half the height, the pin sits below it.
  expect(sheetPadding(200, 100, 50, 1)).toEqual({ top: 40, bottom: 0 });
  // A bar that ends at half the height leaves the pin where it is.
  expect(sheetPadding(200, 80, 50, 1)).toEqual({ top: 0, bottom: 0 });
  expect(sheetPadding(800, 64, 300, 2)).toEqual({ top: 84, bottom: 320 });
});
it("shortens the release motion with the way left and keeps up with a fast flick", () => {
  // A long way left without speed takes the full 280ms.
  expect(sheetReleaseDuration(400, 0)).toBe(280);
  // A short way left is quicker, but never under 160ms.
  expect(sheetReleaseDuration(-60, 0)).toBe(184);
  expect(sheetReleaseDuration(5, 0)).toBe(162);
  // Released at rest on its stop, the sheet still has a duration.
  expect(sheetReleaseDuration(0, 0)).toBe(160);
  // The curve leaves at four times its average speed: a flick toward the
  // stop that is faster still shortens the motion to keep up with it.
  expect(sheetReleaseDuration(-300, -6)).toBe(200);
  // Speed away from the stop does not.
  expect(sheetReleaseDuration(300, -6)).toBe(280);
});
