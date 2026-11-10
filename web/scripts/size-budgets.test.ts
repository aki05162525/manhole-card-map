import { describe, expect, it } from "vitest";
import { checkBudgets, linkedStylesheets } from "./size-budgets.mjs";

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
      {
        file: "dist/assets/app-hash.css",
        brotli: 29_000,
        entries: ["index.html"],
      },
      { file: "dist/maplibre-gl-worker.mjs", brotli: 120_000 },
    ]),
  ).not.toThrow();
});

it("budgets only the stylesheets an entry page links", () => {
  const entryBudget = [
    {
      name: "map entry CSS",
      pattern: /\.css$/,
      entry: "index.html",
      limit: 100,
    },
  ];
  const rows = [
    { file: "dist/assets/main.css", brotli: 90, entries: ["index.html"] },
    { file: "dist/assets/account.css", brotli: 500, entries: ["account.html"] },
    { file: "dist/assets/records.css", brotli: 500 },
  ];
  expect(checkBudgets(rows, entryBudget)).toEqual([
    { name: "map entry CSS", brotli: 90, limit: 100 },
  ]);
  expect(() =>
    checkBudgets(
      [{ ...rows[0]!, brotli: 101 }, rows[1]!, rows[2]!],
      entryBudget,
    ),
  ).toThrow(/map entry CSS.*101.*100/);
  expect(() => checkBudgets(rows.slice(1), entryBudget)).toThrow(/missing/i);
});

it("reads stylesheet links, not preloads or other links, from an entry page", () => {
  expect(
    linkedStylesheets(
      `<link rel="preload" href="/assets/font.woff2">
       <link rel="stylesheet" crossorigin href="/assets/main-a1.css">
       <link href="/assets/tokens-b2.css" rel="stylesheet">
       <link rel="icon" href="/favicon.svg">`,
    ),
  ).toEqual(["/assets/main-a1.css", "/assets/tokens-b2.css"]);
});
