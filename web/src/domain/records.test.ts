import { expect, it } from "vitest";
import { receiptPins } from "./records";
import type { Pin } from "./types";
const pins: Pin[] = [
  {
    id: "shared",
    cardIds: ["a", "b"],
    pref: "東京都",
    kind: "place",
    status: "suspended",
    lat: 35,
    lng: 139,
  },
];
it("distinguishes all, some and none while retaining distribution colors", () => {
  for (const [ids, state] of [
    [[], "none"],
    [["a"], "some"],
    [["a", "b"], "all"],
  ] as const) {
    const records = new Map(
      ids.map((id) => [id, { cardId: id, receivedOn: null }]),
    );
    const pin = receiptPins(pins, records, "all")[0];
    expect(pin).toMatchObject({
      status: "suspended",
      receipt: state,
    });
  }
  expect(receiptPins(pins, null, "unreceived")).toBe(pins);
});
it("filters individual cards of shared pins without calling a partial receipt complete", () => {
  const records = new Map([["a", { cardId: "a", receivedOn: null }]]);
  expect(receiptPins(pins, records, "received")[0]).toMatchObject({
    cardIds: ["a"],
    receipt: "some",
  });
  expect(receiptPins(pins, records, "unreceived")[0]).toMatchObject({
    cardIds: ["b"],
    receipt: "some",
  });
});
