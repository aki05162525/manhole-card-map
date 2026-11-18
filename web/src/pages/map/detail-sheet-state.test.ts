import { expect, it } from "vitest";
import { expandDetail, reserve, restoreDetail } from "./detail-sheet-state";

it("unfolds a collapsed sheet before entering full unless swiped", () => {
  expect(expandDetail("collapsed", true, false)).toBe("summary");
  expect(expandDetail("collapsed", true, true)).toBe("full");
  expect(expandDetail("summary", false, true)).toBe("stay");
});

it("restores the requested stop and keeps map movement for the settled layout", () => {
  const map = { kind: "map", run: () => {} } as const;
  expect(restoreDetail(false, [map, { kind: "collapse" }])).toEqual({
    state: "collapsed",
    opening: false,
    pending: [map],
    choose: undefined,
    close: false,
  });
});

it("uses the latest group choice and honors a close requested before Back settles", () => {
  const first = { kind: "group", run: () => {} } as const;
  const last = { kind: "group", run: () => {} } as const;
  const requests = reserve([first, { kind: "close" }], last);
  const restored = restoreDetail(false, requests);
  expect(restored.choose).toBe(last.run);
  expect(restored.close).toBe(true);
  expect(restoreDetail(false, restored.pending).close).toBe(false);
});
