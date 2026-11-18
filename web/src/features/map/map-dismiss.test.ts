import { expect, test } from "vitest";
import {
  floatingDetail,
  dismissOnGesture,
  mapDismissAction,
} from "./map-dismiss";
// The detail floats over the map up to 1000px wide, except on a screen at
// most 540px high and at least 600px wide, where it stands beside the map.
test.each([
  [412, 823, true],
  [1000, 823, true],
  [1001, 823, false],
  [800, 500, false],
  [800, 540, false],
  [800, 541, true],
  [600, 500, false],
  [599, 500, true],
])("at %i×%i the detail floats: %s", (width, height, floating) => {
  expect(floatingDetail(width, height)).toBe(floating);
  expect(mapDismissAction(width, height)).toBe(floating ? "collapse" : "close");
});
test("only user zooms collapse floating details", () => {
  const zoom = { type: "zoomstart", originalEvent: {} };
  expect(dismissOnGesture(412, 823, zoom)).toBe(true);
  expect(dismissOnGesture(1200, 823, zoom)).toBe(false);
  expect(dismissOnGesture(412, 823, { ...zoom, fromApp: true })).toBe(false);
  expect(dismissOnGesture(412, 823, { type: "zoomstart" })).toBe(false);
  for (const type of ["dragstart", "rotatestart", "pitchstart"])
    expect(dismissOnGesture(412, 823, { type, originalEvent: {} })).toBe(false);
});
