import { expect, it } from "vitest";
import { colors } from "./types";
it("shows places that do not hand out cards in one gray, keeping unknown apart", () => {
  expect(colors.suspended).toBe(colors.ended);
  expect(colors.unknown).not.toBe(colors.ended);
});
