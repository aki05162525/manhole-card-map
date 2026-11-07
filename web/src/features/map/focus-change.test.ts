import { expect, test } from "vitest";
import { focusChanged } from "./map-levels";
test("initial and identical focus do not move the camera", () => {
  expect(
    focusChanged({ area: null, pref: null }, { area: null, pref: null }),
  ).toBe(false);
  expect(
    focusChanged({ area: null, pref: null }, { area: "kanto", pref: null }),
  ).toBe(true);
});
