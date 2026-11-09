import { useEffect, useRef, useState } from "react";

/** The original text remains a single DOM node in summary and full view. */
export function SummaryHours({
  hours,
  summaryMode,
  onExpand,
  onFitChange,
}: {
  hours: string[];
  summaryMode: boolean;
  onExpand(): void;
  /** Reports whether the summary shows the whole single original. */
  onFitChange?(fits: boolean): void;
}) {
  const text = useRef<HTMLParagraphElement>(null);
  const [overflow, setOverflow] = useState(false);
  useEffect(() => {
    if (!summaryMode || hours.length !== 1 || !text.current) return;
    const element = text.current;
    const measure = () => {
      if (element.closest(".is-dragging, [data-sheet-moving]")) return;
      const overflows = element.scrollHeight > element.clientHeight;
      setOverflow(overflows);
      onFitChange?.(!overflows);
    };
    const observer = new ResizeObserver(measure);
    const panel = element.closest(".detail-panel");
    panel?.addEventListener("sheet-settled", measure);
    observer.observe(element);
    measure();
    return () => {
      observer.disconnect();
      panel?.removeEventListener("sheet-settled", measure);
    };
  }, [hours, summaryMode, onFitChange]);
  return (
    <div
      className={
        hours.length > 1 ? "summary-hours multiple-periods" : "summary-hours"
      }
    >
      <p ref={text} className="distribution-hours">
        {hours.join("\n")}
      </p>
      {hours.length > 1 ? (
        <button type="button" className="summary-periods" onClick={onExpand}>
          配布時間は時期・曜日で異なります（{hours.length}区分）›
        </button>
      ) : (
        <button
          type="button"
          className={`hours-continue${overflow ? " has-overflow" : ""}`}
          onClick={onExpand}
        >
          <span className="hours-continue-long">続きあり・全文は詳しく ›</span>
          <span className="hours-continue-short">続きあり ›</span>
        </button>
      )}
    </div>
  );
}
