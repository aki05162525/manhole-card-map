import { expect, it } from "vitest";
import {
  lightContrastTable,
  readLightTokens,
} from "../../tools/design/theme-contrast.mjs";

it("keeps every phase-5 light color token unchanged", () => {
  expect(readLightTokens()).toEqual({
    paper: "#f3f1ec",
    sheet: "#fbfaf7",
    white: "#fff",
    rule: "#dcd7cc",
    "rule-strong": "#b9b3a6",
    boundary: "#7b756a",
    ink: "#1d2321",
    "ink-muted": "#5f625e",
    iron: "#1d2321",
    patina: "#2e6f62",
    error: "#8f3a1c",
    "error-bg": "#f7e9e1",
    "active-ink": "#1d5c4a",
    "active-bg": "#e3f0e8",
    "active-pin": "#2e6f62",
    "upcoming-ink": "#33418a",
    "upcoming-bg": "#e6e9f6",
    "upcoming-pin": "#3d4f9a",
    "suspended-ink": "#7a4b00",
    "suspended-bg": "#fbefd9",
    "suspended-pin": "#8a5a00",
    "ended-ink": "#5b6461",
    "ended-bg": "#eceeed",
    "unknown-pin": "#9c3456",
    "pressed-bg": "#ebe8e1",
  });
});

const rows = lightContrastTable();
it.each(rows.filter((row) => row.passes))(
  "preserves passing light contrast: $use $foreground/$background opacity=$opacity",
  ({ ratio, minimum }) => expect(ratio).toBeGreaterThanOrEqual(minimum),
);

// This is a prerequisite rejection, not an assertion that all UI meets WCAG.
// Issue #147 phase 6 forbids shipping dark if either theme cannot pass, while
// this task separately freezes light appearance. Do not lower the threshold.
it("rejects phase 6 with the frozen light input/empty-state palette", () => {
  const failures = rows.filter((row) => !row.passes);
  expect(
    failures.map((row) => [row.use, row.foreground, row.background]),
  ).toEqual([
    ["検索入力・一覧入力の枠", "rule-strong", "sheet"],
    ["地図の通常操作の枠", "rule", "sheet"],
    ["0件の線画（検索）", "rule-strong", "sheet"],
    ["0件の線画（一覧）", "rule-strong", "paper"],
  ]);
  for (const row of failures) {
    expect(row.minimum).toBe(3);
    expect(row.ratio).toBeLessThan(3);
  }
});

it("does not hide missing tokens or silently omit an unparseable color", () => {
  expect(() => lightContrastTable({})).toThrow("Missing token");
  expect(() =>
    lightContrastTable({ ...readLightTokens(), ink: "invalid" }),
  ).toThrow();
});
