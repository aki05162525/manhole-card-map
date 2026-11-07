import { useEffect, type RefObject } from "react";
import { painted } from "../../shared/browser/painted";
import { metrics } from "../../shared/browser/explorer-metrics";
export function useSelectionMetrics(
  detailRef: RefObject<HTMLElement | null>,
  selection: { started: number } | null,
) {
  useEffect(() => {
    if (!selection) return;
    // The sheet may still be sliding in; scrolling to it would shift the whole page.
    detailRef.current
      ?.querySelector<HTMLElement>("h2")
      ?.focus({ preventScroll: true });
    let cancelled = false;
    void painted().then(() => {
      if (cancelled) return;
      metrics.taps.push(performance.now() - selection.started);
      performance.mark("pin-tap", { startTime: selection.started });
      performance.mark("detail-painted");
      performance.measure("pin-to-detail", "pin-tap", "detail-painted");
    });
    return () => {
      cancelled = true;
    };
  }, [detailRef, selection]);
}
