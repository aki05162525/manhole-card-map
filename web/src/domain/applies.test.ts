import { describe, expect, it } from "vitest";
import { appliesLabel } from "./applies";
import type { Applies } from "./types";

describe("appliesLabel", () => {
  it.each<[Applies, string]>([
    [
      { kind: "calendar", weekdays: [5, 1, 3, 2, 4], holiday: "exclude" },
      "平日",
    ],
    [{ kind: "calendar", weekdays: [6, 7], holiday: "include" }, "土日祝"],
    [
      { kind: "calendar", weekdays: [1, 2, 3, 5, 6, 7], holiday: "asWeekday" },
      "木曜以外",
    ],
    [
      {
        kind: "calendar",
        weekdays: [1, 2, 3, 5, 6, 7],
        holiday: "asWeekday",
        season: { from: "10-01", to: "03-31" },
      },
      "10〜3月の木曜以外",
    ],
    [
      { kind: "calendar", weekdays: [1, 2, 3, 5, 6, 7], holiday: "include" },
      "木曜以外と祝日",
    ],
    ...[
      ["04-01", "03-31"],
      ["01-01", "12-31"],
      ["03-01", "02-29"],
      ["02-29", "02-28"],
    ].map(([from, to]): [Applies, string] => [
      {
        kind: "calendar",
        weekdays: [1, 2, 3, 4, 5],
        holiday: "exclude",
        season: { from: from, to: to },
      },
      "平日",
    ]),
    [
      {
        kind: "calendar",
        weekdays: [1],
        holiday: "asWeekday",
        season: { from: "03-01", to: "02-28" },
      },
      "3/1〜2/28の月曜",
    ],
    [{ kind: "annual", from: "12-31", to: "01-03" }, "12/31〜1/3"],
    [{ kind: "closedDayOf", placeId: "f", closure: "all" }, "資料館の休館日"],
    [
      { kind: "closedDayOf", placeId: "f", closure: "temporary" },
      "資料館の臨時休館日",
    ],
    [{ kind: "text", label: "第3月曜" }, "第3月曜"],
    [{ kind: "openDays" }, "開館日"],
    [{ kind: "calendar", weekdays: [], holiday: "include" }, "祝日"],
    [
      { kind: "calendar", weekdays: [1], holiday: "exclude" },
      "月曜（祝日を除く）",
    ],
    [
      {
        kind: "except",
        base: { kind: "openDays" },
        excluded: { kind: "annual", from: "12-31", to: "01-03" },
      },
      "開館日（12/31〜1/3を除く）",
    ],
  ])("%j → %s", (a, label) =>
    expect(appliesLabel(a, () => "資料館")).toBe(label),
  );
});
