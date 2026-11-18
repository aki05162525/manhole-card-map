import { readdirSync, readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { errorStatus } from "./api-errors";

const worker = new URL("../../worker/", import.meta.url);
const sources = readdirSync(worker)
  .filter((name) => name.endsWith(".ts") && !/\.test\.ts$|^test-/.test(name))
  .map((name) => readFileSync(new URL(name, worker), "utf8"));

// Where the Worker makes a failure's answer: `new HttpError("…")`, and the
// code `readName` throws one with (its last argument). Every `{ error }`
// body comes from an HttpError (`failure` in http.ts). A log that names a
// code (`console.warn` of `record_alias_collision`) is not an answer and
// does not count: it stays a plain string, as a log may tell of a code the
// API no longer answers with.
const answered = sources.flatMap((source) => [
  ...[...source.matchAll(/new HttpError\(\s*"([a-z_]+)"/g)].map(
    ([, code]) => code,
  ),
  ...[...source.matchAll(/\breadName\(((?:[^()]|\([^()]*\))*)\)/g)].flatMap(
    ([, args]) => /"([a-z_]+)"\s*,?\s*$/.exec(args)?.[1] ?? [],
  ),
]);

// The screen has wording for every code of `errorStatus` (its table is a
// Record of them), so this keeps the two sets the same: a code the Worker
// stops answering with leaves the list.
it("lists exactly the error codes the Worker answers with", () => {
  expect(new Set(answered)).toEqual(new Set(Object.keys(errorStatus)));
});
