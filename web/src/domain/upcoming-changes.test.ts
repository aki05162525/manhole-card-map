import { expect, it } from "vitest";
import { upcomingChanges } from "./upcoming-changes";
import type { Applies, Data } from "./types";

type Relation = Data["relations"][number];
const relation = (fields: Partial<Relation>): Relation => ({
  cardId: "card",
  placeId: "a",
  condition: "",
  periodRaw: "",
  alternativeRaw: "",
  status: "active",
  ...fields,
});
const names = (id: string) => (id === "a" ? "本館" : id);

it("says when the hours change and what they become (Mibu A2)", () => {
  const weekends: Applies = {
    kind: "calendar",
    weekdays: [6, 7],
    holiday: "include",
  };
  const current = relation({
    hours: ["9:00～17:00", "在庫がなくなり次第終了"],
    applies: weekends,
    upcoming: [
      {
        validFrom: "2027-01-20",
        status: "active",
        hours: ["9:00～16:30", "在庫がなくなり次第終了"],
        applies: weekends,
        condition: "",
      },
    ],
  });
  expect(upcomingChanges(current, names)).toEqual([
    {
      from: "2027-01-20",
      status: "active",
      detail: "\n9:00～16:30\n在庫がなくなり次第終了",
    },
  ]);
});

it("names only the status when a closed counter reopens with the same hours (Dazaifu)", () => {
  const current = relation({
    status: "suspended",
    hours: ["10:00～18:00"],
    condition: "一時移転期間中はこの窓口で配布しません。",
    upcoming: [
      {
        validFrom: "2026-12-23",
        status: "active",
        hours: ["10:00～18:00"],
        condition: "",
      },
    ],
  });
  expect(upcomingChanges(current, names)).toEqual([
    { from: "2026-12-23", status: "active", detail: "" },
  ]);
});

it.each(["suspended", "ended"] as const)(
  "announces a counter %s without hours or a reopening it was not given (Ota)",
  (status) => {
    const current = relation({
      hours: ["9:00～17:00"],
      condition: "②",
      upcoming: [
        {
          validFrom: "2026-11-30",
          status,
          hours: ["9:00～17:30"],
          condition: "②",
        },
      ],
    });
    expect(upcomingChanges(current, names)).toEqual([
      { from: "2026-11-30", status, detail: "" },
    ]);
  },
);

it("states a changed day condition, its end and a new note, in the given order", () => {
  const current = relation({
    hours: ["9時"],
    upcoming: [
      {
        validFrom: "2026-09-01",
        validTo: "2026-10-31",
        status: "active",
        applies: {
          kind: "calendar",
          weekdays: [1, 2, 3, 4, 5],
          holiday: "exclude",
        },
        condition: "1人1枚",
      },
      { validFrom: "2026-11-01", status: "ended", condition: "" },
    ],
  });
  expect(upcomingChanges(current, names)).toEqual([
    {
      from: "2026-09-01",
      status: "active",
      detail: "（平日）・2026-10-31まで\n1人1枚",
    },
    { from: "2026-11-01", status: "ended", detail: "" },
  ]);
});

it("has nothing to announce without later periods", () => {
  expect(upcomingChanges(relation({}), names)).toEqual([]);
  expect(upcomingChanges(relation({ upcoming: [] }), names)).toEqual([]);
});
