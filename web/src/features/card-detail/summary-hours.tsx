import { useEffect, useRef, useState } from "react";

/** The original text remains a single DOM node in summary and full view. */
export function SummaryHours({
  hours,
  summaryMode,
  onExpand,
}: {
  hours: string[];
  summaryMode: boolean;
  onExpand(): void;
}) {
  const text = useRef<HTMLParagraphElement>(null);
  const [overflow, setOverflow] = useState(false);
  useEffect(() => {
    if (!summaryMode || hours.length !== 1 || !text.current) return;
    const element = text.current;
    const measure = () =>
      setOverflow(element.scrollHeight > element.clientHeight);
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    measure();
    return () => observer.disconnect();
  }, [hours, summaryMode]);
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
      ) : overflow ? (
        <button type="button" className="hours-continue" onClick={onExpand}>
          続きあり・全文は詳しく ›
        </button>
      ) : null}
    </div>
  );
}
