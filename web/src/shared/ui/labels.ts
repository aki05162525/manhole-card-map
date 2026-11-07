import type { Status } from "../../domain/types";
export const labels: Record<Status, string> = {
  active: "配布中",
  upcoming: "配布開始前",
  suspended: "一時中止",
  ended: "配布終了",
  unknown: "要確認",
};
