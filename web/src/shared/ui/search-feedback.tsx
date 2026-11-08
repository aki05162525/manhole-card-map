import type { ReactNode, RefObject } from "react";
import type { CatalogEntry } from "../../domain/card-catalog";
import "./search-feedback.css";

const emptyArt = (
  <svg
    className="search-empty-art"
    width="80"
    height="80"
    viewBox="0 0 32 32"
    fill="none"
    stroke="currentColor"
    aria-hidden="true"
  >
    <circle
      className="search-drawn-line"
      pathLength="100"
      cx="16"
      cy="16"
      r="14"
      strokeWidth="1"
    />
    <circle
      cx="16"
      cy="16"
      r="11.6"
      strokeWidth=".8"
      strokeDasharray="1.2 4.874"
    />
    <circle
      className="search-drawn-line"
      pathLength="100"
      cx="16"
      cy="16"
      r="8.6"
      strokeWidth=".6"
    />
    <rect
      className="search-drawn-line"
      pathLength="100"
      x="12.5"
      y="12.5"
      width="7"
      height="7"
      rx="1"
      strokeWidth=".8"
    />
  </svg>
);

export function SearchEmptyState({
  title,
  headingRef,
  children,
}: {
  title: string;
  headingRef?: RefObject<HTMLHeadingElement | null>;
  children?: ReactNode;
}) {
  return (
    <div className="search-empty-state">
      {emptyArt}
      <h2 ref={headingRef} tabIndex={-1} className="search-empty-title">
        {title}
      </h2>
      {children}
    </div>
  );
}
export function SearchSkeleton() {
  return (
    <div className="search-skeleton" aria-hidden="true">
      <span />
      <span />
      <span />
    </div>
  );
}
export function SearchPin({
  entry,
}: {
  entry: Pick<CatalogEntry, "hasPin" | "pinReasons">;
}) {
  const reason = entry.pinReasons.includes("relation-review")
    ? "再確認待ち"
    : entry.pinReasons.includes("no-facility")
      ? "施設未登録"
      : "位置未確定";
  return (
    <span className="search-pin">
      <svg width="8" height="8" viewBox="0 0 10 10" aria-hidden="true">
        <rect
          x="1"
          y="1"
          width="8"
          height="8"
          rx="1"
          fill={entry.hasPin ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="1.5"
        />
      </svg>
      <span aria-hidden="true">
        {entry.hasPin ? "あり" : `なし · ${reason}`}
      </span>
      <span className="search-feedback-sr-only">
        配布施設ピン{entry.hasPin ? "あり" : "なし"}
      </span>
      {!entry.hasPin && (
        <span className="search-feedback-sr-only"> · {reason}</span>
      )}
    </span>
  );
}
