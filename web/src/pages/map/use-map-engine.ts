import { useEffect, useState } from "react";
import { painted } from "../../shared/browser/painted";
import { diagnosticsEnabled } from "../../shared/browser/explorer-metrics";

/**
 * How long the drawing shown first is left alone before the map engine is
 * read behind it. MapLibre's 460KB and its start take the line and the main
 * thread from the presses that follow one another (a region, a prefecture,
 * a facility); a press waited for in that time is not slowed by them.
 */
const ENGINE_QUIET = 1000;

/**
 * Whether the map that moves (MapLibre, and every pin) is read: once what
 * is shown can be used without it (`usable`: a region's choices, or a
 * prefecture's facilities drawn), nothing it waits for is still on the line
 * (`busy`), and it has been left alone for `ENGINE_QUIET`; at once when it
 * is `wanted` (a drag or a pinch, a card it cannot show). Once read it
 * stays; `activity` is any press, which starts the quiet again.
 */
export function useMapEngine({
  usable,
  busy,
  wanted,
  activity,
}: {
  usable: boolean;
  busy: boolean;
  wanted: boolean;
  activity: unknown;
}) {
  const [started, setStarted] = useState(false);
  if (wanted && !started) setStarted(true);
  useEffect(() => {
    if (started || !usable || busy) return;
    let timer: number | undefined;
    let cancelled = false;
    void painted().then(() => {
      if (!cancelled)
        timer = window.setTimeout(() => setStarted(true), ENGINE_QUIET);
    });
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [started, usable, busy, activity]);
  useEffect(() => {
    if (started && diagnosticsEnabled()) performance.mark("map-create");
  }, [started]);
  return started;
}
