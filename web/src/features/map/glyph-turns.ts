/**
 * MapLibre draws the glyphs of Japanese text itself, on the main thread
 * (`localIdeographFontFamily`), and draws all a tile asks for in one go: a
 * zoom into a town brings hundreds of new characters, and the map stood
 * still for half a second while they were drawn. Here they are drawn a few
 * milliseconds at a time, with the map's frames in between; the labels of
 * that tile appear a moment later instead.
 */

import type { Map as MapLibreMap } from "maplibre-gl";

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
 */
export function takeTurns(
  now: () => number = () => performance.now(),
  wait: () => Promise<void> = nextTurn,
  budget = BUDGET,
) {
  let last: Promise<unknown> = Promise.resolve();
  let turnStarted = -Infinity;
  return <T>(work: () => Promise<T>): Promise<T> => {
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

// MapLibre's own method, not part of its documented API. Its type declaration
// names it, so an update that drops or renames it fails the type check here.
const DRAW = "_drawGlyph" satisfies keyof MapLibreMap["style"]["glyphManager"];
type GlyphManager = {
  [DRAW]?: (...args: never[]) => Promise<unknown>;
};
const inTurns = new WeakSet();

/** Makes the map draw its glyphs in turns; one that cannot draws as before. */
export function yieldGlyphDrawing(map: {
  style?: { glyphManager?: GlyphManager };
}) {
  const manager = map.style?.glyphManager;
  const draw = manager?.[DRAW];
  if (!manager || !draw || inTurns.has(manager)) return;
  inTurns.add(manager);
  const turn = takeTurns();
  manager[DRAW] = (...args) => turn(() => draw.apply(manager, args));
}
