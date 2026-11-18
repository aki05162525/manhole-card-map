import { expect, it } from "vitest";
import { isRecoveryCodes } from "./private-api";
import { showRecoveryCode } from "./recovery-codes";

// Ten codes as the Worker shows them (AU-8): 16 Crockford Base32 symbols,
// in groups of four.
const issued = Array.from(
  { length: 10 },
  (_, index) => `0123-4567-89AB-CDE${"FGHJKMNPQR"[index]}`,
);
const nine = issued.slice(1);

it("takes the ten codes the Worker issues", () => {
  expect(isRecoveryCodes({ recoveryCodes: issued })).toBe(true);
});
it("shows a code as the Worker keeps it in groups of four", () => {
  expect(showRecoveryCode("0123456789ABCDEF")).toBe("0123-4567-89AB-CDEF");
});

// A success short of its codes would have the screen ask the user to keep
// an empty or broken list.
it.each([
  ["no codes", []],
  ["nine codes", nine],
  ["eleven codes", [...issued, "ZZZZ-ZZZZ-ZZZZ-ZZZZ"]],
  ["an empty code", [...nine, ""]],
  ["a code without its groups", [...nine, "0123456789ABCDEZ"]],
  ["a code of 12 symbols", [...nine, "0123-4567-89AB"]],
  ["a symbol Crockford leaves out", [...nine, "0123-4567-89AB-CDEU"]],
  ["lower case", [...nine, "0123-4567-89ab-cdez"]],
  ["a code twice", [...nine, issued[1]]],
  ["a code that is not a string", [...nine, 1]],
])("refuses %s", (_, recoveryCodes) => {
  expect(isRecoveryCodes({ recoveryCodes })).toBe(false);
});
