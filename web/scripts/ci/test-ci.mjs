import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { ciRelatedTests } from "./ci-tests.ts";

const related = ciRelatedTests(process.env.CI_TEST_RELATED);
const args = related ? ["related", "--run", ...related] : ["run"];
console.log(
  related ? "PR import dependants and external-input tests" : "Full test suite",
);
const result = spawnSync(
  process.execPath,
  [
    fileURLToPath(
      new URL("../../node_modules/vitest/vitest.mjs", import.meta.url),
    ),
    ...args,
    ...process.argv.slice(2),
  ],
  { stdio: "inherit" },
);
if (result.error) console.error(result.error);
process.exitCode = result.status ?? 1;
