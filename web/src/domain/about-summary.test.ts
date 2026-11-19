import { expect, it } from "vitest";
import { summarizeAbout } from "./about-summary";
import { testCard, testPin } from "./test-data";

const data = (fields: { evaluatedAt?: string; fixture?: boolean } = {}) => ({
  cards: [testCard({ id: "a" }), testCard({ id: "b" })],
  pins: [
    testPin({ id: "hall" }),
    testPin({ id: "station" }),
    testPin({ id: "lid:a", kind: "lid" }),
  ],
  updated: "2026-11-01",
  ...fields,
});

it("counts the cards and the distribution places, as of the evaluation date", () => {
  expect(summarizeAbout(data({ evaluatedAt: "2026-11-10" }))).toEqual({
    cardCount: 2,
    placeCount: 2,
    asOf: "2026-11-10",
    fixture: false,
  });
  // Data without an evaluation date is as of its update.
  expect(summarizeAbout(data()).asOf).toBe("2026-11-01");
  expect(summarizeAbout(data({ fixture: true })).fixture).toBe(true);
});

it.each(["", "2026-11-1", "2026/11/10", "x2026-11-10", "2026-11-10T00:00:00Z"])(
  "fails the build on the reference date %j",
  (evaluatedAt) => {
    expect(() =>
      summarizeAbout({ ...data(), updated: "", evaluatedAt }),
    ).toThrow("Invalid about reference date");
  },
);
