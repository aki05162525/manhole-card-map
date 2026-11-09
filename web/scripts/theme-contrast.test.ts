import { expect, it } from "vitest";
import {
  themeContrastTable,
  readThemeTokens,
} from "../../tools/design/theme-contrast.mjs";

it("keeps every phase-5 light color token unchanged", () => {
  const {
    "control-border": controlBorder,
    "on-iron": onIron,
    "on-iron-soft": onIronSoft,
    ...original
  } = readThemeTokens("light");
  expect(controlBorder).toBe("#827b70");
  expect(onIron).toBe("#fff");
  expect(onIronSoft).toBe("#fbfaf7");
  expect(original).toEqual({
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

for (const theme of ["light", "dark"] as const) {
  it.each(themeContrastTable(readThemeTokens(theme)))(
    `${theme} $category $use $foreground/$background opacity=$opacity`,
    ({ ratio, minimum }) => expect(ratio).toBeGreaterThanOrEqual(minimum),
  );
}
it("classifies aria-hidden art as decorative with a visibility target", () => {
  const art = themeContrastTable(readThemeTokens("light")).filter(
    (row) => row.category === "装飾（対象外）",
  );
  expect(art.length).toBeGreaterThan(0);
  expect(art.every((row) => row.minimum === 1.5)).toBe(true);
});
it("rejects missing tokens and unsupported colors", () => {
  expect(() => themeContrastTable({})).toThrow("Missing token");
  expect(() =>
    themeContrastTable({ ...readThemeTokens("light"), ink: "invalid" }),
  ).toThrow();
});
