import { expect, it } from "vitest";
import { firstCanvasDraw } from "./canvas-ready";

it("does not report readiness until Canvas actually draws", async () => {
  const renderer = { _redraw() {} };
  let ready = false;
  const done = firstCanvasDraw(renderer).then(() => {
    ready = true;
  });
  await Promise.resolve();
  expect(ready).toBe(false);
  renderer._redraw();
  await done;
  expect(ready).toBe(true);
});
it("reports initial Canvas drawing exceptions", async () => {
  const renderer = {
    _redraw() {
      throw new Error("canvas failed");
    },
  };
  const done = firstCanvasDraw(renderer);
  renderer._redraw();
  await expect(done).rejects.toThrow("canvas failed");
});
