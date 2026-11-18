import { expect, it } from "vitest";
import {
  expandDetail,
  release,
  reserve,
  restoreDetail,
  takeMap,
} from "./detail-sheet-state";

it("unfolds a collapsed sheet before entering full unless swiped", () => {
  expect(expandDetail("collapsed", true, false)).toBe("summary");
  expect(expandDetail("collapsed", true, true)).toBe("full");
  expect(expandDetail("summary", false, true)).toBe("stay");
  expect(expandDetail("full", true, false)).toBe("stay");
});

it("keeps group and close on panel release, dropping map and collapse", () => {
  const group = () => {};
  const actions = release({
    group,
    map: () => {},
    close: true,
    collapse: true,
  });
  const restored = restoreDetail(false, actions);
  expect(restored.state).toBe("summary");
  expect(restored.choose).toBe(group);
  expect(restored.close).toBe(true);
  expect(takeMap(restored.pending).move).toBeUndefined();
});

it("reserves only in full view and moves the map once after restoring the stop", () => {
  const map = () => {};
  const pending = { map: () => {}, collapse: true } as const;
  expect(reserve(false, pending, { map })).toBeNull();
  const reserved = reserve(true, pending, { map })!;
  const restored = restoreDetail(false, reserved);
  expect(restored.state).toBe("collapsed");
  expect(restored.opening).toBe(false);
  const taken = takeMap(restored.pending);
  expect(taken.move).toBe(map);
  expect(takeMap(taken.pending).move).toBeUndefined();
  expect(restoreDetail(true, reserved).state).toBe("full");
});

it("taking the map preserves requests still waiting for history", () => {
  const group = () => {};
  const taken = takeMap({ map: () => {}, group, close: true, collapse: true });
  const restored = restoreDetail(false, taken.pending);
  expect(restored.choose).toBe(group);
  expect(restored.close).toBe(true);
  expect(restored.state).toBe("collapsed");
  const next = restoreDetail(false, restored.pending);
  expect(next.choose).toBeUndefined();
  expect(next.close).toBeUndefined();
  expect(next.state).toBe("summary");
});
