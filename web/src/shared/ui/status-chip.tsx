import type { Status } from "../../domain/types";
import "./status-chip.css";
const states = {
  active: ["配布中", "■"],
  upcoming: ["配布予定", "■"],
  suspended: ["一時中止", "◧"],
  ended: ["終了", "□"],
  unknown: ["未確認", "□"],
} as const;
export function StatusChip({ status }: { status: Status }) {
  const [label, shape] = states[status];
  return (
    <span className={`status-chip status-chip-${status}`}>
      <span aria-hidden="true">{shape}</span> {label}
    </span>
  );
}
