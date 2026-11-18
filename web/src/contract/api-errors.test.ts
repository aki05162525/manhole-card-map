import { readdirSync, readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { errorStatus } from "./api-errors";

const worker = new URL("../../worker/", import.meta.url);
const sources = readdirSync(worker)
  .filter((name) => name.endsWith(".ts") && !/\.test\.ts$|^test-/.test(name))
  .map((name) => readFileSync(new URL(name, worker), "utf8"));

// The screen has wording for every code of `errorStatus` (its table is a
// Record of them), so this keeps the two sets the same: a code the Worker
// stops returning leaves the list, and a body written without `HttpError`
// names only listed codes.
it("lists exactly the error codes the Worker returns", () => {
  const listed = Object.keys(errorStatus);
  const named = sources.flatMap((source) => [
    ...source.matchAll(/HttpError\(\s*"([a-z_]+)"/g),
    ...source.matchAll(/error: "([a-z_]+)"/g),
  ]);
  for (const [, code] of named) expect(listed).toContain(code);
  for (const code of listed)
    expect(sources.some((source) => source.includes(`"${code}"`))).toBe(true);
});
