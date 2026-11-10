import { expect, test, vi } from "vitest";
import { active, canonical, currentRecords, spellings } from "./card-ids";

vi.mock("../../data/card-ids.json", () => ({
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
  expect(
    currentRecords([
      { cardId: "13-100-A002", receivedOn: "2026-11-02" },
      { cardId: "13-100-A001", receivedOn: "2026-11-01" },
      { cardId: "01-100-A001", receivedOn: null },
    ]),
  ).toEqual([
    { cardId: "01-100-A001", receivedOn: null },
    { cardId: "13-100-A002", receivedOn: "2026-11-02" },
  ]);
  expect(
    currentRecords([{ cardId: "13-100-A001", receivedOn: "2026-11-01" }]),
  ).toEqual([{ cardId: "13-100-A002", receivedOn: "2026-11-01" }]);
});
