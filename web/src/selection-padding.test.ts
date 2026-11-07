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
it("fits multiple pins between bar and sheet", () => {
  expect(
    paddingForSelection({
      bounds: rect(0, 0, 400, 800),
      headerBottom: 64,
      sheetHeight: 300,
      count: 3,
    }),
  ).toEqual({ left: 24, right: 24, top: 84, bottom: 320 });
});
it("preserves desktop right and short landscape left padding", () => {
  expect(
    paddingForSelection({
      bounds: rect(0, 0, 1200, 800),
      headerBottom: 64,
      sheetHeight: 0,
      detail: rect(800, 100, 350, 600),
    }),
  ).toEqual({ left: 24, right: 420, top: 84, bottom: 70 });
  expect(
    paddingForSelection({
      bounds: rect(0, 0, 800, 400),
      headerBottom: 64,
      sheetHeight: 0,
      detail: rect(12, 100, 400, 180),
    }),
  ).toEqual({ left: 432, right: 65, top: 84, bottom: 60 });
});
it("scales padding to keep small viewports valid", () => {
  const p = paddingForSelection({
    bounds: rect(0, 0, 100, 100),
    headerBottom: 64,
    sheetHeight: 50,
    count: 2,
  });
  expect(p.top + p.bottom).toBeLessThanOrEqual(60);
  expect(p.left + p.right).toBeLessThanOrEqual(60);
});
