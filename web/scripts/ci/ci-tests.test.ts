import { describe, expect, test } from "vitest";
import { createVitest } from "vitest/node";
import { matchesGlob, relative, resolve } from "node:path";
import { readFileSync } from "node:fs";
import { balancedShards, ciRelatedTests } from "./ci-tests";

describe("CI test allocation", () => {
  test("spreads long files across runners instead of splitting by file count", () => {
    const files = [
      { id: "a", duration: 60 },
      { id: "b", duration: 50 },
      { id: "c", duration: 10 },
      { id: "d", duration: 10 },
      { id: "e", duration: 10 },
      { id: "f", duration: 10 },
    ];
    const shards = balancedShards(files, 3);
    const durations = new Map(files.map((file) => [file.id, file.duration]));
    expect(
      shards.map((shard) =>
        shard.reduce((sum, id) => sum + durations.get(id)!, 0),
      ),
    ).toEqual([60, 50, 40]);
    expect(shards.flat().sort()).toEqual(files.map((file) => file.id));
    // Independent runners can discover files in different filesystem orders.
    expect(balancedShards([...files].reverse(), 3)).toEqual(shards);
  });

  test("cold, missing and invalid timings never drop or duplicate a test", () => {
    const files = [
      { id: "node:a" },
      { id: "dom:a", duration: Number.NaN },
      { id: "worker:a", duration: -1 },
      { id: "node:b", duration: 0 },
      { id: "node:c", duration: Number.POSITIVE_INFINITY },
      { id: "node:d", duration: 20 },
      { id: "node:e", duration: 10 },
    ];
    for (const count of [1, 3, 10]) {
      const shards = balancedShards(files, count);
      expect(shards).toHaveLength(count);
      expect(shards.flat().sort()).toEqual(files.map((file) => file.id).sort());
      expect(balancedShards([...files].reverse(), count)).toEqual(shards);
    }
    expect(balancedShards([{ id: "a" }, { id: "b" }, { id: "c" }], 3)).toEqual([
      ["a"],
      ["b"],
      ["c"],
    ]);
    expect(balancedShards([], 3)).toEqual([[], [], []]);
    for (const count of [0, -1, 1.5]) {
      expect(() => balancedShards(files, count)).toThrow();
    }
  });
});

describe("CI related tests", () => {
  test("full runs remain full and malformed selections fail", () => {
    expect(ciRelatedTests(undefined)).toBeUndefined();
    expect(ciRelatedTests("null")).toBeUndefined();
    for (const selection of ['"src/a.ts"', "{}", "[42]", "["]) {
      expect(() => ciRelatedTests(selection)).toThrow();
    }
  });

  test("keeps filesystem, subprocess and nonliteral-import tests alongside import dependants", () => {
    const related = ciRelatedTests('["src/domain/card-selection.ts"]')!;
    expect(related).toContain("src/domain/card-selection.ts");
    expect(related).toContain("scripts/checks/internal-links.test.ts");
    expect(related).toContain("scripts/checks/deploy.test.ts");
    // Worker inputs, including src/contract, select the full suite in changes.py.
    expect(related).not.toContain("worker/auth-workerd.test.ts");
    // The entry test now has a literal import; Vitest selects it through the graph.
    expect(related).not.toContain("src/entries.dom.test.tsx");
    expect(related).toContain("src/shared/ui/site-header-layout.dom.test.tsx");
    expect(related).not.toContain("src/domain/map-links.test.ts");
    expect(new Set(related).size).toBe(related.length);
  });

  test("Vitest follows transitive imports while omitting unrelated source and Worker tests", async () => {
    const related = ciRelatedTests('["src/domain/map-links.ts"]')!.map((path) =>
      resolve(path),
    );
    const ctx = await createVitest({ run: true, watch: false, related });
    try {
      const selected = (await ctx.getRelevantTestSpecifications()).map((spec) =>
        relative(process.cwd(), spec.moduleId),
      );
      expect(selected).toContain("src/domain/map-links.test.ts");
      expect(selected).toContain(
        "src/features/card-detail/card-detail.dom.test.tsx",
      );
      expect(selected).toContain("scripts/checks/no-service-worker.test.ts");
      expect(selected).toContain("src/entries.dom.test.tsx");
      expect(selected).not.toContain("src/domain/applies.test.ts");
      expect(selected.some((file) => file.startsWith("worker/"))).toBe(false);
      // Vitest appends its own directory and project hash to cacheDir.
      // Verify the lookup/restore/save globs against the resolved runtime path.
      const workflow = readFileSync("../.github/workflows/ci.yml", "utf8");
      const cachePaths = [
        ...workflow.matchAll(/path: (web\/\.cache\/vitest\/\S+)/g),
      ].map((match) => match[1]);
      const resultPath = relative(
        resolve(".."),
        resolve(ctx.viteConfig.cacheDir, "results.json"),
      );
      expect(cachePaths).toHaveLength(3);
      expect(
        cachePaths.every((pattern) => matchesGlob(resultPath, pattern)),
      ).toBe(true);
    } finally {
      await ctx.close();
    }
  });
});
