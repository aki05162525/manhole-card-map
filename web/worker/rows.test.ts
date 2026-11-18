import { expect, test } from "vitest";
import { columns } from "./rows";

const read = columns({
  id: "text",
  count: "integer",
  memo: "text?",
  kind: ["normal", "recovery"],
  key: "blob",
});
const stored = {
  id: "a",
  count: 1,
  memo: null,
  kind: "normal",
  key: new ArrayBuffer(2),
};

test("passes a row that has every column the statement selects", () => {
  expect(read(stored)).toBe(stored);
  expect(read({ ...stored, memo: "m", key: [1, 2] }).memo).toBe("m");
});

test.each([
  ["a renamed column", { ...stored, id: undefined, user_id: "a" }],
  ["a count read as text", { ...stored, count: "1" }],
  ["a fraction in an INTEGER column", { ...stored, count: 1.5 }],
  ["NULL in a NOT NULL column", { ...stored, id: null }],
  ["a value outside the list", { ...stored, kind: "admin" }],
  ["a BLOB of strings", { ...stored, key: ["1"] }],
  ["no row object", "a"],
])("fails the request on %s", (_, value) => {
  expect(() => read(value)).toThrow("D1 returned a row of another shape");
});
