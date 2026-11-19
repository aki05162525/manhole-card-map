import { expect, it } from "vitest";
import { readCatalogSummary, summarizeCatalog } from "./catalog-summary";
import { testCard } from "./test-data";

it("carries no evaluation date for data without one", () => {
  const summary = summarizeCatalog({
    cards: [testCard({ id: "a", pref: "北海道" })],
  });
  expect(summary.evaluatedAt).toBe("");
  expect(summary.totals["01"]).toBe(1);
  expect(readCatalogSummary({ catalogTotals: "01:1,other:0" })).toEqual({
    evaluatedAt: "",
    totals: { "01": 1, other: 0 },
  });
});
