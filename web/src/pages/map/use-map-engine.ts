import { useEffect, useState } from "react";
import { painted } from "../../shared/browser/painted";
import { diagnosticsEnabled } from "../../shared/browser/explorer-metrics";
import { readMapEngine } from "../../features/map/map-stage";

/**
 * How long nothing is pressed or typed before the map engine is created
 * behind the drawing. Creating it holds the main thread for a while; a
 * press that comes meanwhile waits for it. The presses that follow one
 * another (a region, a prefecture, a facility) come sooner than this.
 */
const ENGINE_QUIET = 2000;
/** What a person does: each starts the quiet again. */
const INPUTS = ["pointerdown", "keydown", "wheel", "input"] as const;

/**
 * The map that moves (MapLibre, and every pin), in two steps of its own.
 *
 * Its code is read once the first view can be used and has been painted
 * (`usable`): reading is on the line, not on the main thread.
 *
 * It is created (`started`) at once when it is `wanted` (a drag, a pinch or
 * a wheel; a card the drawing cannot show; a prefecture's file that failed).
 * Otherwise only once its code has come, what the view waits for is no
 * longer on the line (`busy`), nothing on the page is in use (`held`: a
 * list open, a finger down, the search typed into, another screen shown),
 * and nothing has been pressed or typed for `ENGINE_QUIET`. Once created it
 * stays; when it replaces the drawing is the page's to say.
 */
export function useMapEngine({
  usable,
  busy,
  wanted,
  held,
}: {
  usable: boolean;
  busy: boolean;
  wanted: boolean;
  held: boolean;
}) {
  const [started, setStarted] = useState(false);
  const [read, setRead] = useState(false);
  if (wanted && !started) setStarted(true);
  useEffect(() => {
    if (!usable) return;
    let cancelled = false;
    void painted().then(() => {
      if (cancelled) return;
      // Settled either way: a failure is told by the map it was for.
      const settle = () => {
        if (!cancelled) setRead(true);
      };
      readMapEngine().then(settle, settle);
    });
    return () => {
      cancelled = true;
    };
  }, [usable]);
  useEffect(() => {
    if (started || !read || !usable || busy || held) return;
    let timer: number | undefined;
    const wait = () => {
      clearTimeout(timer);
      timer = window.setTimeout(() => setStarted(true), ENGINE_QUIET);
    };
    wait();
    for (const type of INPUTS)
      window.addEventListener(type, wait, { capture: true, passive: true });
    return () => {
      clearTimeout(timer);
      for (const type of INPUTS)
        window.removeEventListener(type, wait, { capture: true });
    };
  }, [started, read, usable, busy, held]);
  useEffect(() => {
    if (started && diagnosticsEnabled()) performance.mark("map-create");
  }, [started]);
  return started;
}
