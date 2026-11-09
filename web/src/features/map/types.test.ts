import { expect, it } from "vitest";
import { colors } from "./types";
it("distinguishes suspended, ended and unknown places", () => {
  expect(colors.suspended).not.toBe(colors.ended);
  expect(colors.unknown).not.toBe(colors.ended);
});
