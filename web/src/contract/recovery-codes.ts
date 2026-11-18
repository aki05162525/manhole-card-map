import type { Guard } from "./shape";

// AU-8: ten codes, each 16 Crockford Base32 symbols (80 random bits), shown
// in groups of four. The Worker issues them (`worker/recovery-codes.ts`) and
// the screen takes a list as issued only in this form.

export const recoveryCodeCount = 10;
export const recoveryCodeAlphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
export const recoveryCodeLength = 16;

const symbol = "[0-9A-HJKMNP-TV-Z]";
const group = 4;

/** A code as the Worker keeps it: its symbols alone. */
export const canonicalRecoveryCode = new RegExp(
  `^${symbol}{${recoveryCodeLength}}$`,
);
const shown = new RegExp(
  `^${symbol}{${group}}(?:-${symbol}{${group}}){${recoveryCodeLength / group - 1}}$`,
);

/** A code as it is shown: its symbols in groups of four. */
export const showRecoveryCode = (code: string) =>
  code.match(new RegExp(`.{${group}}`, "g"))!.join("-");

const isShownRecoveryCode: Guard<string> = (value): value is string =>
  typeof value === "string" && shown.test(value);

/** A whole issue: as many codes as the Worker issues, each shown, none twice. */
export const isRecoveryCodeList: Guard<string[]> = (value): value is string[] =>
  Array.isArray(value) &&
  value.length === recoveryCodeCount &&
  value.every((code) => isShownRecoveryCode(code)) &&
  new Set(value).size === value.length;
