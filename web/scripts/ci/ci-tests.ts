import { globSync, readFileSync } from "node:fs";
import { relative } from "node:path";
import { BaseSequencer, type TestSpecification } from "vitest/node";

type TimedFile = { id: string; duration?: number | undefined };

// Longest first, placed on the least loaded runner. All shards must restore
// the same immutable timing snapshot (resolved once by the changes job).
export function balancedShards(files: TimedFile[], count: number): string[][] {
  if (!Number.isInteger(count) || count < 1)
    throw new Error("Invalid shard count");
  const measured = files
    .map((file) => file.duration)
    .filter(
      (value): value is number =>
        value !== undefined && Number.isFinite(value) && value > 0,
    )
    .sort((a, b) => a - b);
  const fallback = measured[Math.floor(measured.length / 2)] ?? 1;
  const weighted = files
    .map(({ id, duration }) => ({
      id,
      weight:
        duration !== undefined && Number.isFinite(duration) && duration > 0
          ? duration
          : fallback,
    }))
    .sort(
      (a, b) => b.weight - a.weight || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
    );
  const shards = Array.from({ length: count }, () => ({
    files: [] as string[],
    weight: 0,
  }));
  for (const file of weighted) {
    const target = shards.reduce((best, shard) =>
      shard.weight < best.weight ||
      (shard.weight === best.weight && shard.files.length < best.files.length)
        ? shard
        : best,
    );
    target.files.push(file.id);
    target.weight += file.weight;
  }
  return shards.map((shard) => shard.files);
}

export class TimingSequencer extends BaseSequencer {
  override async shard(files: TestSpecification[]) {
    const { index, count } = this.ctx.config.shard!;
    const id = (spec: TestSpecification) =>
      `${spec.project.name}:${relative(this.ctx.config.root, spec.moduleId)}`;
    const shards = balancedShards(
      files.map((spec) => ({
        id: id(spec),
        duration: this.ctx.cache.getTestSpecificationResult(spec)?.duration,
      })),
      count,
    );
    const selected = new Set(shards[index - 1]);
    return files.filter((spec) => selected.has(id(spec)));
  }
}

export function ciRelatedTests(
  value: string | undefined,
): string[] | undefined {
  const changed: unknown = JSON.parse(value ?? "null");
  if (changed === null) return undefined;
  if (
    !Array.isArray(changed) ||
    !changed.every((path) => typeof path === "string")
  ) {
    throw new Error("CI_TEST_RELATED must be null or an array of paths");
  }
  // Import reachability cannot see filesystem reads, script subprocesses or
  // nonliteral dynamic imports. Keep these checks on every selected PR run.
  // Worker runtime inputs (including src/contract) force a full run
  // in changes.py, so unrelated UI edits need not start workerd.
  const always = globSync([
    "scripts/**/*.test.ts",
    "src/**/*.test.{ts,tsx}",
  ]).filter(
    (file) =>
      file.startsWith("scripts/") ||
      /(?:node:)?(?:fs|child_process)["'/]|\bimport\s*\(\s*[^\s"'`]/.test(
        readFileSync(file, "utf8"),
      ),
  );
  return [...new Set([...changed, ...always])];
}
