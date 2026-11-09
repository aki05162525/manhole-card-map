import type { Status } from "../../domain/types";
export const labels: Record<Status, string> = {
  active: "配布中",
  upcoming: "配布予定",
  suspended: "一時中止",
  ended: "終了",
  unknown: "未確認",
};
