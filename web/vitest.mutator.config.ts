import { readdirSync, readFileSync } from "node:fs";
import {
  defineConfig,
  type TestProjectInlineConfiguration,
} from "vitest/config";
import base from "./vitest.config.ts";

// The projects of vitest.config.ts, changed for mutation runs (mutator.config.ts).
//
// mutator adds its instrumenting Vite plugin to the root server only. A project
// with Vite options of its own (the dom project's `resolve`) gets a server
// without it, and no mutant is seen there. Its options move to the root and the
// project extends it.
//
// Worker tests that start workerd through test-harness.ts are left out: they
// take seconds per file and run every covering test for each surviving mutant.
const inProcessWorkerTests = readdirSync("worker")
  .filter((file) => file.endsWith(".test.ts"))
  .filter(
    (file) =>
      !readFileSync(`worker/${file}`, "utf8").includes('"./test-harness"'),
  )
  .map((file) => `worker/${file}`);

const projects = (base.test?.projects ?? []).filter(
  (project): project is TestProjectInlineConfiguration =>
    typeof project === "object" && "test" in project,
);
const named = (name: string) => {
  const project = projects.find((p) => p.test?.name === name);
  if (!project) throw new Error(`vitest.config.ts has no ${name} project`);
  return project;
};
const node = named("node");
const worker = named("worker");
const { resolve, ...dom } = named("dom");
if (projects.length !== 3 || Object.keys(dom).length !== 1)
  throw new Error("vitest.config.ts changed: update vitest.mutator.config.ts");

export default defineConfig({
  ...base,
  ...(resolve ? { resolve } : {}),
  test: {
    ...base.test,
    projects: [
      node,
      { ...worker, test: { ...worker.test, include: inProcessWorkerTests } },
      { ...dom, extends: true },
    ],
  },
});
