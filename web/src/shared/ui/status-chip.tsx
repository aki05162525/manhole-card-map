import type { Status } from "../../domain/types";
import "./status-chip.css";
const labels = {
  active: "配布中",
  upcoming: "配布予定",
  suspended: "一時中止",
  ended: "終了",
  unknown: "未確認",
};
export function StatusChip({ status }: { status: Status }) {
  const filled = status === "active" || status === "upcoming";
  return (
    <span className={`status-chip status-chip-${status}`}>
      <svg
        width="10"
        height="10"
        viewBox="0 0 10 10"
        aria-hidden="true"
        className="status-shape"
      >
        <rect
          x="0.75"
          y="0.75"
          width="8.5"
          height="8.5"
          fill={filled ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="1.5"
        />
        {status === "suspended" && <path d="M1 1h4v8H1z" fill="currentColor" />}
      </svg>
      {labels[status]}
    </span>
  );
}
