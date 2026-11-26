import { expect, it } from "vitest";
import { paddingForSelection } from "./selection-padding";
it("uses the bar and layout sheet height to place one pin at 25 percent", () => {
  const p = paddingForSelection({
    width: 400,
    height: 800,
    top: 64,
    sheetHeight: 300,
    count: 1,
  });
  expect((p.top + 800 - p.bottom) / 2).toBe(200);
});
it("fits multiple pins between bar and sheet", () => {
  expect(
    paddingForSelection({
      width: 400,
      height: 800,
      top: 64,
      sheetHeight: 300,
      count: 3,
    }),
  ).toEqual({ left: 24, right: 24, top: 84, bottom: 320 });
});
it("clears the panel on the left, on a desktop and in a short landscape", () => {
  expect(
    paddingForSelection({
      width: 1200,
      height: 800,
      top: 64,
      sheetHeight: 0,
      panel: 436,
    }),
  ).toEqual({ left: 456, right: 65, top: 84, bottom: 70 });
  const landscape = { height: 400, top: 64, sheetHeight: 0, panel: 412 };
  expect(paddingForSelection({ width: 800, ...landscape })).toEqual({
    left: 432,
    right: 65,
    top: 84,
    bottom: 60,
  });
  // The widest screen that still counts as a phone's.
  expect(paddingForSelection({ width: 1000, ...landscape })).toEqual({
    left: 432,
    right: 65,
    top: 84,
    bottom: 60,
  });
});
it("scales padding to keep small viewports valid", () => {
  // Too low for the bar and the sheet: both shrink alike, the sides fit.
  const low = paddingForSelection({
    width: 100,
    height: 100,
    top: 64,
    sheetHeight: 50,
    count: 2,
  });
  expect(low.top + low.bottom).toBeCloseTo(60);
  expect(low.top / low.bottom).toBeCloseTo(84 / 70);
  expect(low).toMatchObject({ left: 24, right: 24 });
  // Too narrow for a wide panel and the controls.
  const narrow = paddingForSelection({
    width: 800,
    height: 400,
    top: 64,
    sheetHeight: 0,
    panel: 712,
  });
  expect(narrow.left + narrow.right).toBeCloseTo(760);
  expect(narrow.left / narrow.right).toBeCloseTo(732 / 65);
  expect(narrow).toMatchObject({ top: 84, bottom: 60 });
  // No room at all leaves no padding rather than a negative one.
  expect(
    paddingForSelection({ width: 30, height: 30, top: 64, sheetHeight: 50 }),
  ).toEqual({ left: 0, right: 0, top: 0, bottom: 0 });
});
