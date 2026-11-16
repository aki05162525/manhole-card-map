import { contrastRatio } from "../../tools/design/color-contrast.mjs";
import { expect, it } from "vitest";
import {
  themeContrastTable,
  mapContrastTable,
  readMapPalette,
  readThemeTokens,
} from "../../tools/design/theme-contrast.mjs";

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

for (const theme of ["light", "dark"] as const) {
  it.each(mapContrastTable(readMapPalette(theme), theme === "dark"))(
    `${theme} $use $foreground/$background opacity=$opacity`,
    ({ ratio, minimum }) => expect(ratio).toBeGreaterThanOrEqual(minimum),
  );
}

for (const theme of ["light", "dark"] as const) {
  it(`keeps the ${theme} stamp text readable on its sheet`, () => {
    const tokens = readThemeTokens(theme);
    expect(
      contrastRatio(tokens["stamp-ink"], tokens.sheet),
    ).toBeGreaterThanOrEqual(4.5);
  });
}
