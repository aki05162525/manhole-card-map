import { describe, expect, it } from "vitest";
import { checkBudgets } from "./size-budgets.mjs";

describe("Brotli budgets", () => {
  const budgets = [{ name: "JS", pattern: /\.js$/, limit: 100 }];
  it("accepts the boundary and rejects one extra byte", () => {
    expect(() =>
      checkBudgets([{ file: "a.js", brotli: 100 }], budgets),
    ).not.toThrow();
    expect(() =>
      checkBudgets([{ file: "a.js", brotli: 101 }], budgets),
    ).toThrow(/JS.*101.*100/);
  });
  it("sums shared chunks once and fails closed on missing inputs", () => {
    expect(() =>
      checkBudgets(
        [
          { file: "a.js", brotli: 60 },
          { file: "b.js", brotli: 41 },
        ],
        budgets,
      ),
    ).toThrow();
    expect(() => checkBudgets([], budgets)).toThrow(/missing/i);
  });
});

it("budgets the engine and module worker separately despite their shared filename prefix", () => {
  expect(() =>
    checkBudgets([
      { file: "dist/assets/app-hash.js", brotli: 100_000 },
      { file: "dist/assets/maplibre-gl-hash.js", brotli: 240_000 },
      { file: "dist/assets/maplibre-gl-worker-hash.js", brotli: 120_000 },
      { file: "dist/assets/app-hash.css", brotli: 50_000 },
      { file: "dist/maplibre-gl-worker.mjs", brotli: 120_000 },
    ]),
  ).not.toThrow();
});
