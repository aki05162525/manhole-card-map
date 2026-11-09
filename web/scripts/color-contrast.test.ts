import { expect, it } from "vitest";
import {
  contrastRatio,
  composite,
} from "../../tools/design/color-contrast.mjs";

it("calculates WCAG sRGB contrast, including shorthand and symmetry", () => {
  expect(contrastRatio("#000", "#fff")).toBe(21);
  expect(contrastRatio("#fff", "#000")).toBe(21);
  expect(contrastRatio("#777777", "#777777")).toBe(1);
  expect(contrastRatio("#777777", "#ffffff")).toBeCloseTo(4.478, 3);
  expect(contrastRatio("#595c58", "#cdd6d5")).toBeCloseTo(4.578, 2);
});

it("composites translucent sRGB ink before calculating contrast", () => {
  expect(composite("#000", "#fff", 0.5)).toEqual([127.5, 127.5, 127.5]);
  expect(contrastRatio(composite("#000", "#fff", 0.5), "#fff")).toBeCloseTo(
    3.977,
    3,
  );
});

it("rejects unsupported colors and invalid opacity instead of returning NaN", () => {
  for (const color of ["red", "#1234", "#gggggg", "#12345678"])
    expect(() => contrastRatio(color, "#fff")).toThrow();
  for (const opacity of [-1, 2, NaN])
    expect(() => composite("#000", "#fff", opacity)).toThrow();
});
