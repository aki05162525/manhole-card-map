import { expect, test } from "vitest";
import { currentCardId, currentRecords } from "./card-ids";

const aliases = { "13-100-A001": "13-100-A002" };

test("reads an old card number as the current one", () => {
  expect(currentCardId("13-100-A001", aliases)).toBe("13-100-A002");
  expect(currentCardId("01-100-A001", aliases)).toBe("01-100-A001");
});

test("counts a renumbered card once and prefers the current number", () => {
  expect(
    currentRecords(
      [
        { cardId: "13-100-A002", receivedOn: "2026-11-02" },
        { cardId: "13-100-A001", receivedOn: "2026-11-01" },
        { cardId: "01-100-A001", receivedOn: null },
      ],
      aliases,
    ),
  ).toEqual([
    { cardId: "01-100-A001", receivedOn: null },
    { cardId: "13-100-A002", receivedOn: "2026-11-02" },
  ]);
  expect(
    currentRecords(
      [{ cardId: "13-100-A001", receivedOn: "2026-11-01" }],
      aliases,
    ),
  ).toEqual([{ cardId: "13-100-A002", receivedOn: "2026-11-01" }]);
});
