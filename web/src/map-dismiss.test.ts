import { expect, test } from "vitest";
import {
  floatingDetail,
  dismissOnGesture,
  mapDismissAction,
} from "./map-dismiss";
test("floating layout excludes wide short screens", () => {
  expect(floatingDetail(412, 823)).toBe(true);
  expect(floatingDetail(1001, 823)).toBe(false);
  expect(floatingDetail(800, 500)).toBe(false);
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
test("map operations collapse the mobile sheet and close other panels", () => {
  expect(mapDismissAction(412, 823)).toBe("collapse");
  expect(mapDismissAction(1200, 823)).toBe("close");
  expect(mapDismissAction(800, 500)).toBe("close");
});
