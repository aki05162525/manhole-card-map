import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import {
  SHEET_CLOSE_MS,
  SHEET_OPEN_CURVE,
  SHEET_OPEN_MS,
  SHEET_SUMMARY_GAP,
  SHEET_SUMMARY_LIMIT,
} from "./sheet-motion";

const read = (path: string) =>
  readFileSync(new URL(path, import.meta.url), "utf8").replaceAll(/\s+/g, " ");
const tokens = read("../../shared/ui/tokens.css");
const map = read("../../pages/map/style.css");
const declared = (name: string) =>
  [...tokens.matchAll(new RegExp(`--${name}: ([^;]+);`, "g"))].map(
    (match) => match[1],
  );

// The timers and inline transitions of the drag and the close run on these
// numbers, and the CSS moves the sheet on the tokens: both have to agree.
it("times the sheet in TypeScript as tokens.css does", () => {
  expect(declared("sheet-open")).toEqual([`${SHEET_OPEN_MS}ms`]);
  expect(declared("sheet-close")).toEqual([`${SHEET_CLOSE_MS}ms`]);
  expect(declared("sheet-open-easing")).toEqual([SHEET_OPEN_CURVE]);
});

// use-explorer-layout.ts measures the summary under the same limit and gap
// that style.css holds it to.
it("limits the summary in TypeScript as style.css does", () => {
  const { percent, least, mostPercent, most } = SHEET_SUMMARY_LIMIT;
  const limit = `min(max(${percent}dvh, ${least}px), ${mostPercent}dvh, ${most}px)`;
  expect(map).toContain(
    `max-block-size: calc( ${limit} - var(--sheet-bar-height, 44px) - max(var(--sheet-action-height, 0px), env(safe-area-inset-bottom)) - ${SHEET_SUMMARY_GAP}px );`,
  );
  expect(map).toContain(
    `padding-bottom: calc(var(--sheet-action-height, 0px) + ${SHEET_SUMMARY_GAP}px);`,
  );
});
