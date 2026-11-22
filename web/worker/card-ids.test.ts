import { expect, test, vi } from "vitest";
import { active, canonical, currentRecords, spellings } from "./card-ids";

vi.mock(import("../../data/card-ids.json"), () => ({
  default: {
    ids: ["13-100-A001", "13-100-A002", "01-100-A001", "gone"],
    aliases: { "13-100-A001": "13-100-A002" },
    excluded: { gone: "withdrawn" },
  },
}));

test("reads an old card number as the current one", () => {
  expect(canonical("13-100-A001")).toBe("13-100-A002");
  expect(canonical("01-100-A001")).toBe("01-100-A001");
  expect(spellings.get("13-100-A002")).toEqual(["13-100-A002", "13-100-A001"]);
  expect([...active]).toEqual(["13-100-A002", "01-100-A001"]);
});

test("counts a renumbered card once and prefers the current number", () => {
  const old = { cardId: "13-100-A001", receivedOn: "2026-11-01" };
  const current = { cardId: "13-100-A002", receivedOn: "2026-11-02" };
  const other = { cardId: "01-100-A001", receivedOn: null };
  // Whichever was stored first, in whatever order the rows come.
  for (const records of [
    [current, old, other],
    [old, current, other],
    [other, old, current],
  ])
    expect(currentRecords(records)).toEqual([other, current]);
  expect(currentRecords([old])).toEqual([
    { cardId: "13-100-A002", receivedOn: "2026-11-01" },
  ]);
});
