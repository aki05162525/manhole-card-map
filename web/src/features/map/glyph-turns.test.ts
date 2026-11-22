import { expect, it } from "vitest";
import { takeTurns, yieldGlyphDrawing } from "./glyph-turns";
import { fakeMapLibre } from "./fake-maplibre";
import { createMapRuntime } from "./map-runtime";

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
      return id * 10;
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
  const failed = turn(() => {
    throw new Error("no canvas");
  });
  const next = turn(() => "drawn");
  await clock.nextTurn();
  await expect(failed).rejects.toThrow("no canvas");
  expect(await next).toBe("drawn");
});

/** A glyph manager as MapLibre's: a font to wait for, then the drawing. */
function fakeManager() {
  const fonts = new Map<string, () => void>();
  const drawn: string[] = [];
  return {
    drawn,
    /** Lets the font of that stack finish loading. */
    load: (stack: string) => fonts.get(stack)?.(),
    manager: {
      [DRAW]: (_entry: object, _stack: string, _id: string): Promise<string> =>
        Promise.reject(new Error("replaced")),
      _getTinySDF(_entry: object, stack: string) {
        return new Promise<string>((resolve) =>
          fonts.set(stack, () => resolve(`${stack} rasterizer`)),
        );
      },
      _getRasterizedGlyph(rasterizer: string, id: string) {
        drawn.push(`${id} by ${rasterizer}`);
        return `${id} glyph`;
      },
    },
  };
}

it("draws a glyph with the font MapLibre prepared for it, once per manager", async () => {
  const { manager, drawn, load } = fakeManager();
  const map = { style: { glyphManager: manager } };
  yieldGlyphDrawing(map);
  const wrapped = manager[DRAW];
  // The runtime asks again on each style change: no second queue.
  yieldGlyphDrawing(map);
  expect(manager[DRAW]).toBe(wrapped);
  const glyph = manager[DRAW]({}, "Open Sans Regular", "東");
  load("Open Sans Regular");
  expect(await glyph).toBe("東 glyph");
  expect(drawn).toEqual(["東 by Open Sans Regular rasterizer"]);
});

it("draws the glyphs of a loaded font while another font is still loading", async () => {
  const { manager, drawn, load } = fakeManager();
  yieldGlyphDrawing({ style: { glyphManager: manager } });
  const slow = manager[DRAW]({}, "Slow", "東");
  const fast = manager[DRAW]({}, "Fast", "京");
  load("Fast");
  expect(await fast).toBe("京 glyph");
  expect(drawn).toEqual(["京 by Fast rasterizer"]);
  load("Slow");
  expect(await slow).toBe("東 glyph");
});

it("leaves a map without a style, or a MapLibre without those methods, as it is", () => {
  expect(() => yieldGlyphDrawing({})).not.toThrow();
  const draw = () => Promise.resolve("glyph");
  const manager = { [DRAW]: draw };
  yieldGlyphDrawing({ style: { glyphManager: manager } });
  expect(manager[DRAW]).toBe(draw);
});

it("puts the glyphs of the map it runs, and of a style built later, in turns", async () => {
  const fake = fakeMapLibre();
  const first = fakeManager();
  Object.assign(fake.maplibre, { style: { glyphManager: first.manager } });
  const runtime = createMapRuntime(fake.maplibre, () => {
    throw new Error("no props are read before the map is loaded");
  });
  const glyph = first.manager[DRAW]({}, "Open Sans Regular", "東");
  first.load("Open Sans Regular");
  expect(await glyph).toBe("東 glyph");
  // A restored WebGL context: MapLibre builds the style again.
  const second = fakeManager();
  Object.assign(fake.maplibre, { style: { glyphManager: second.manager } });
  fake.emit("styledata");
  const later = second.manager[DRAW]({}, "Open Sans Regular", "京");
  second.load("Open Sans Regular");
  expect(await later).toBe("京 glyph");
  runtime.dispose();
});
