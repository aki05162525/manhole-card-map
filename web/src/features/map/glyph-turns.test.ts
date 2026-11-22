import { expect, it } from "vitest";
import { takeTurns, yieldGlyphDrawing } from "./glyph-turns";

// MapLibre's name for the method (glyph-turns.ts).
const DRAW = "_drawGlyph";
/** Lets every promise that is already due run. */
async function settle() {
  for (let i = 0; i < 50; i++) await Promise.resolve();
}
/** A clock the test moves, and turns of the event loop it lets pass. */
function harness() {
  let time = 0;
  const waiting: (() => void)[] = [];
  return {
    advance: (ms: number) => (time += ms),
    now: () => time,
    wait: () => new Promise<void>((resolve) => waiting.push(resolve)),
    settle,
    /** Ends the turn: the work waiting for the next one goes on. */
    async nextTurn() {
      await settle();
      waiting.shift()?.();
      await settle();
    },
  };
}

it("draws glyphs in order and hands the thread back once a turn's budget is spent", async () => {
  const clock = harness();
  const turn = takeTurns(clock.now, clock.wait, 5);
  const drawn: number[] = [];
  // Each glyph takes 2ms to draw.
  const results = [1, 2, 3, 4, 5, 6].map((id) =>
    turn(() => {
      clock.advance(2);
      drawn.push(id);
      return Promise.resolve(id * 10);
    }),
  );
  // Nothing is drawn in the turn that asked: the tile's message returns.
  await clock.settle();
  expect(drawn).toEqual([]);
  await clock.nextTurn();
  expect(drawn).toEqual([1, 2, 3]);
  await clock.nextTurn();
  expect(drawn).toEqual([1, 2, 3, 4, 5, 6]);
  expect(await Promise.all(results)).toEqual([10, 20, 30, 40, 50, 60]);
});

it("goes on with the next glyph after one fails, and reports the failure to its caller", async () => {
  const clock = harness();
  const turn = takeTurns(clock.now, clock.wait, 5);
  const failed = turn(() => Promise.reject(new Error("no canvas")));
  const next = turn(() => Promise.resolve("drawn"));
  await clock.nextTurn();
  await expect(failed).rejects.toThrow("no canvas");
  expect(await next).toBe("drawn");
});

it("puts the map's glyph drawing in turns once, keeping its arguments and result", async () => {
  const calls: unknown[][] = [];
  const manager = {
    [DRAW](...args: unknown[]) {
      calls.push([this, ...args]);
      return Promise.resolve("glyph");
    },
  };
  const original = manager[DRAW];
  const map = { style: { glyphManager: manager } };
  yieldGlyphDrawing(map);
  const wrapped = manager[DRAW];
  expect(wrapped).not.toBe(original);
  // A second runtime on the same map adds no second queue.
  yieldGlyphDrawing(map);
  expect(manager[DRAW]).toBe(wrapped);
  expect(await manager[DRAW]("entry", "Open Sans Regular", "東")).toBe("glyph");
  expect(calls).toEqual([[manager, "entry", "Open Sans Regular", "東"]]);
});

it("leaves a map without a style, or a MapLibre without that method, as it is", () => {
  expect(() => yieldGlyphDrawing({})).not.toThrow();
  const manager = {};
  yieldGlyphDrawing({ style: { glyphManager: manager } });
  expect(manager).toEqual({});
});
