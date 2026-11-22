import type { Status } from "../../domain/types";
import "./status-chip.css";
import { labels } from "./labels";

/**
 * A card's state as the map's legend would give it: the pin the map draws
 * for that state (`features/map/map-resources.ts`: filled, half for a
 * suspension, hollow once ended or while unconfirmed) and the state's name.
 */
export function StatusChip({ status }: { status: Status }) {
  const filled = status === "active" || status === "upcoming";
  return (
    <span className={`status-chip status-chip-${status}`}>
      <svg
        width="12"
        height="12"
        viewBox="0 0 12 12"
        aria-hidden="true"
        className="status-shape"
      >
        <rect
          x="0.75"
          y="0.75"
          width="10.5"
          height="10.5"
          fill={filled ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="1.5"
        />
        {status === "suspended" && (
          <rect
            x="0.75"
            y="0.75"
            width="5.25"
            height="10.5"
            fill="currentColor"
          />
        )}
      </svg>
      {labels[status]}
    </span>
  );
}
