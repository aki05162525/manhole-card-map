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
// Only tests that run the mutated sources in process are collected. The tests
// under scripts/ check build scripts and start servers or child processes, and
// the other Worker tests start workerd: mutants are not observed there.
const nodeTests = ["src/**/*.test.ts"];
const workerTests = ["worker/card-ids.test.ts", "worker/rows.test.ts"];

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
      { ...node, test: { ...node.test, include: nodeTests } },
      { ...worker, test: { ...worker.test, include: workerTests } },
      { ...dom, extends: true },
    ],
  },
});
