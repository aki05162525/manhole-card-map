import type { Map as MapLibreMap } from "maplibre-gl";

/**
 * MapLibre draws the glyphs of Japanese text itself, on the main thread
 * (`localIdeographFontFamily`), and draws all a tile asks for in one go: a
 * zoom into a town brings hundreds of new characters, and the map stood
 * still for half a second while they were drawn. Here they are drawn a few
 * milliseconds at a time, with the map's frames in between; the tile that
 * asked for them appears a moment later instead.
 */

/** How long glyphs may be drawn before the thread is handed back, in ms. */
const BUDGET = 5;

/** The next turn of the event loop, without a timer's minimum delay. */
function nextTurn() {
  return new Promise<void>((resolve) => {
    const channel = new MessageChannel();
    channel.port1.onmessage = () => {
      channel.port1.close();
      resolve();
    };
    channel.port2.postMessage(null);
  });
}

/**
 * Runs each piece of work after the one before it, and waits for the next
 * turn of the event loop whenever the work of this turn has taken `budget`.
 * The first piece always waits: the message that asked for it returns first.
 * The work itself does not wait for anything, so nothing can hold the queue.
 */
export function takeTurns(
  now: () => number = () => performance.now(),
  wait: () => Promise<void> = nextTurn,
  budget = BUDGET,
) {
  let last: Promise<unknown> = Promise.resolve();
  let turnStarted = -Infinity;
  return <T>(work: () => T): Promise<T> => {
    const result = last.then(async () => {
      if (now() - turnStarted >= budget) {
        await wait();
        turnStarted = now();
      }
      return work();
    });
    // A glyph that fails is its caller's; the next one is still drawn.
    last = result.catch(() => {});
    return result;
  };
}

// MapLibre's own methods, not part of its documented API. Its type
// declaration names them, so an update that drops or renames one fails the
// type check here. `_drawGlyph` is `_getTinySDF` (which may wait for a font
// to load) followed by `_getRasterizedGlyph` (which draws, and keeps what it
// drew for a second request of the same glyph).
type Manager = MapLibreMap["style"]["glyphManager"];
const DRAW = "_drawGlyph" satisfies keyof Manager;
const PREPARE = "_getTinySDF" satisfies keyof Manager;
const RASTERIZE = "_getRasterizedGlyph" satisfies keyof Manager;
type GlyphManager<Rasterizer> = {
  [DRAW]?: (
    entry: never,
    stack: never,
    id: never,
    family?: never,
  ) => Promise<unknown>;
  [PREPARE]?: (
    entry: never,
    stack: never,
    id: never,
    family?: never,
  ) => Promise<Rasterizer>;
  [RASTERIZE]?: (rasterizer: Rasterizer, id: never) => unknown;
};
const inTurns = new WeakSet();

/**
 * Makes the map draw its glyphs in turns; one that cannot draws as before.
 * Each glyph's font is awaited on its own, so a font that never loads holds
 * only its own glyphs; only the drawing takes its turn.
 */
export function yieldGlyphDrawing<Rasterizer>(map: {
  style?: { glyphManager?: GlyphManager<Rasterizer> };
}) {
  const manager = map.style?.glyphManager;
  const prepare = manager?.[PREPARE];
  const rasterize = manager?.[RASTERIZE];
  if (!manager?.[DRAW] || !prepare || !rasterize || inTurns.has(manager))
    return;
  inTurns.add(manager);
  const turn = takeTurns();
  manager[DRAW] = async (entry, stack, id, family) => {
    const rasterizer = await prepare.call(manager, entry, stack, id, family);
    return turn(() => rasterize.call(manager, rasterizer, id));
  };
}
