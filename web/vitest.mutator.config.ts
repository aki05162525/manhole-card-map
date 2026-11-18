import {
  defineConfig,
  type TestProjectInlineConfiguration,
} from "vitest/config";
import base from "./vitest.config.ts";

// The projects of vitest.config.ts, for mutation runs (mutator.config.ts).
//
// Only tests that run the mutated sources in process are collected. The tests
// under scripts/ check build scripts and start servers or child processes, and
// the other Worker tests start workerd: mutants are not observed there.
const include: Record<string, string[]> = {
  node: ["src/**/*.test.ts"],
  worker: ["worker/card-ids.test.ts", "worker/rows.test.ts"],
};

const changed = () =>
  new Error("vitest.config.ts changed: update vitest.mutator.config.ts");
const projects = (base.test?.projects ?? []).map(
  (project): TestProjectInlineConfiguration => {
    if (typeof project !== "object" || !("test" in project)) throw changed();
    const { test } = project;
    const narrowed =
      typeof test?.name === "string" ? include[test.name] : undefined;
    return narrowed
      ? { ...project, test: { ...test, include: narrowed } }
      : project;
  },
);
const names = new Set(projects.map(({ test }) => test?.name));
if (Object.keys(include).some((name) => !names.has(name))) throw changed();

export default defineConfig({
  ...base,
  test: { ...base.test, projects },
});
