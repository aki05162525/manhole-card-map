/**
 * What a measurement script reads of the drawing shown before the map
 * engine (`scripts/perf/map-performance.mjs`), as it reads the map's own
 * diagnostics once the map is handed over: the view, and a point to press.
 */
export type StageDiagnostics = {
  view(): { lat: number; lng: number; zoom: number };
  /** A badge by its area or prefecture, or a facility alone under a press. */
  tapPoint(id?: string): { x: number; y: number } | null;
};
let shown: StageDiagnostics | undefined;
/** The drawing shown now, or none once the map has replaced it. */
export const stageDiagnostics = () => shown;
export function showStageDiagnostics(diagnostics: StageDiagnostics) {
  shown = diagnostics;
  return () => {
    if (shown === diagnostics) shown = undefined;
  };
}
