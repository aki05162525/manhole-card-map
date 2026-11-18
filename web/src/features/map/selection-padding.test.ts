import { expect, it } from "vitest";
import { paddingForSelection } from "./selection-padding";
const rect = (left: number, top: number, width: number, height: number) => ({
  left,
  top,
  width,
  height,
  right: left + width,
  bottom: top + height,
});
it("uses the bar and layout sheet height to place one pin at 25 percent", () => {
  const p = paddingForSelection({
    bounds: rect(0, 0, 400, 800),
    headerBottom: 64,
    sheetHeight: 300,
    count: 1,
  });
  expect((p.top + 800 - p.bottom) / 2).toBe(200);
});
// The map does not start at the page's corner: every panel is measured from
// the map's own edges.
it("fits multiple pins between bar and sheet", () => {
  expect(
    paddingForSelection({
      bounds: rect(10, 50, 400, 800),
      headerBottom: 114,
      sheetHeight: 300,
      count: 3,
    }),
  ).toEqual({ left: 24, right: 24, top: 84, bottom: 320 });
});
it("clears a desktop panel on the right and a short landscape one on the left", () => {
  expect(
    paddingForSelection({
      bounds: rect(10, 20, 1200, 800),
      headerBottom: 84,
      sheetHeight: 0,
      detail: rect(810, 120, 350, 600),
    }),
  ).toEqual({ left: 24, right: 420, top: 84, bottom: 70 });
  const landscape = {
    headerBottom: 84,
    sheetHeight: 0,
    detail: rect(22, 120, 400, 180),
  };
  expect(
    paddingForSelection({ bounds: rect(10, 20, 800, 400), ...landscape }),
  ).toEqual({ left: 432, right: 65, top: 84, bottom: 60 });
  // The widest screen that still counts as a phone's.
  expect(
    paddingForSelection({ bounds: rect(10, 20, 1000, 400), ...landscape }),
  ).toEqual({ left: 432, right: 65, top: 84, bottom: 60 });
});
it("scales padding to keep small viewports valid", () => {
  // Too low for the bar and the sheet: both shrink alike, the sides fit.
  const low = paddingForSelection({
    bounds: rect(0, 0, 100, 100),
    headerBottom: 64,
    sheetHeight: 50,
    count: 2,
  });
  expect(low.top + low.bottom).toBeCloseTo(60);
  expect(low.top / low.bottom).toBeCloseTo(84 / 70);
  expect(low).toMatchObject({ left: 24, right: 24 });
  // Too narrow for a wide panel and the controls.
  const narrow = paddingForSelection({
    bounds: rect(0, 0, 800, 400),
    headerBottom: 64,
    sheetHeight: 0,
    detail: rect(12, 100, 700, 180),
  });
  expect(narrow.left + narrow.right).toBeCloseTo(760);
  expect(narrow.left / narrow.right).toBeCloseTo(732 / 65);
  expect(narrow).toMatchObject({ top: 84, bottom: 60 });
  // No room at all leaves no padding rather than a negative one.
  expect(
    paddingForSelection({
      bounds: rect(0, 0, 30, 30),
      headerBottom: 64,
      sheetHeight: 50,
    }),
  ).toEqual({ left: 0, right: 0, top: 0, bottom: 0 });
});
