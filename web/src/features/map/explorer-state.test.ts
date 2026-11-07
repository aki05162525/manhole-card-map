import { expect, it } from "vitest";
import { focusFromHistory } from "./explorer-state";
it("restores history focus and returns to nationwide for an entry without state", () => {
  expect(focusFromHistory(null)).toEqual({ area: null, pref: null });
  expect(focusFromHistory({})).toEqual({ area: null, pref: null });
  expect(
    focusFromHistory({ mapFocus: { area: "kanto", pref: "東京都" } }),
  ).toEqual({ area: "kanto", pref: "東京都" });
});
