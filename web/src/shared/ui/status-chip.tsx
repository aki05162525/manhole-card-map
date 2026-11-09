import type { Status } from "../../domain/types";
import "./status-chip.css";
import { labels } from "./labels";
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
          x="1"
          y="1"
          width="8"
          height="8"
          rx="0"
          fill={filled ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="1.25"
        />
        {status === "suspended" && <path d="M1 1h4v8H1z" fill="currentColor" />}
      </svg>
      {labels[status]}
    </span>
  );
}
