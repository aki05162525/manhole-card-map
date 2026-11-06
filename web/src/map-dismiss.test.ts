import { expect, test } from "vitest";
import { floatingDetail, dismissOnGesture } from "./map-dismiss";
test("floating layout excludes wide short screens", () => {
  expect(floatingDetail(412, 823)).toBe(true);
  expect(floatingDetail(1001, 823)).toBe(false);
  expect(floatingDetail(800, 500)).toBe(false);
});
test("only user gestures dismiss floating details", () => {
  expect(dismissOnGesture(412, 823, { originalEvent: {} })).toBe(true);
  expect(dismissOnGesture(1200, 823, { originalEvent: {} })).toBe(false);
  expect(dismissOnGesture(412, 823, { fromApp: true, originalEvent: {} })).toBe(
    false,
  );
  expect(dismissOnGesture(412, 823, {})).toBe(false);
});
