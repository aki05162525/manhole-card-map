import { expect, it } from "vitest";
import { FINGER_REACH, STAGE_MAX_ZOOM, pressAt } from "./stage-press";

const spots = [
  { id: "a", x: 100, y: 100 },
  { id: "b", x: 110, y: 100 },
  { id: "far", x: 300, y: 300 },
];

it("opens the one facility under a press, nearest first among those near it", () => {
  expect(pressAt(spots, 300, 290, FINGER_REACH, 9)).toEqual({
    kind: "one",
    id: "far",
  });
  expect(pressAt(spots, 200, 200, FINGER_REACH, 9)).toEqual({ kind: "none" });
});

it("comes closer over facilities apart, and lists them where it can come no closer", () => {
  expect(pressAt(spots, 100, 100, FINGER_REACH, 9)).toEqual({
    kind: "closer",
  });
  // 10px apart at the closest drawing: still under one fingertip.
  expect(pressAt(spots, 100, 100, FINGER_REACH, STAGE_MAX_ZOOM)).toEqual({
    kind: "ledger",
    ids: ["a", "b"],
  });
  // 10px apart one zoom short of it would be 20px there: still together.
  expect(pressAt(spots, 100, 100, FINGER_REACH, STAGE_MAX_ZOOM - 1)).toEqual({
    kind: "ledger",
    ids: ["a", "b"],
  });
});

it("lists facilities at the same coordinates at once, at any zoom", () => {
  const same = [
    { id: "a", x: 50, y: 50 },
    { id: "b", x: 50, y: 50 },
  ];
  expect(pressAt(same, 52, 50, FINGER_REACH, 6)).toEqual({
    kind: "ledger",
    ids: ["a", "b"],
  });
});
