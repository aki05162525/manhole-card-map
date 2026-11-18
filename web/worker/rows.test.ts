import { expect, test } from "vitest";
import type { D1PreparedStatement } from "./env";
import { all, columns, first } from "./rows";

const read = columns({
  id: "text",
  count: "integer",
  memo: "text?",
  usedAt: "integer?",
  kind: ["normal", "recovery"],
  key: "blob",
});
const stored = {
  id: "a",
  count: 1,
  memo: null,
  usedAt: null,
  kind: "normal",
  key: new ArrayBuffer(2),
};

test("passes a row that has every column the statement selects", () => {
  expect(read(stored)).toBe(stored);
  const filled = { ...stored, memo: "m", usedAt: 3, key: [1, 2] };
  expect(read(filled)).toBe(filled);
});

test.each([
  ["a renamed column", { ...stored, id: undefined, user_id: "a" }],
  ["a count read as text", { ...stored, count: "1" }],
  ["a fraction in an INTEGER column", { ...stored, count: 1.5 }],
  ["NULL in a NOT NULL column", { ...stored, id: null }],
  ["a nullable INTEGER read as text", { ...stored, usedAt: "3" }],
  ["a fraction in a nullable INTEGER column", { ...stored, usedAt: 1.5 }],
  ["a value outside the list", { ...stored, kind: "admin" }],
  ["a BLOB of strings", { ...stored, key: ["1"] }],
  ["a BLOB with a string among its bytes", { ...stored, key: [1, "2"] }],
  ["no row object", "a"],
])("fails the request on %s", (_, value) => {
  expect(() => read(value)).toThrow("D1 returned a row of another shape");
});

// What D1 would answer for a statement with these rows.
const statement = (results: unknown[]): D1PreparedStatement => ({
  bind: () => statement(results),
  first: async () => results[0] ?? null,
  all: async () => ({ results }),
  run: async () => ({}),
});

test("reads the first row, and no row as null rather than a failure", async () => {
  expect(await first(statement([stored]), read)).toBe(stored);
  expect(await first(statement([]), read)).toBeNull();
  await expect(first(statement([{ id: "a" }]), read)).rejects.toThrow(
    TypeError,
  );
});

test("reads every row, and fails the request on one of another shape", async () => {
  const other = { ...stored, id: "b" };
  expect(await all(statement([stored, other]), read)).toEqual([stored, other]);
  expect(await all(statement([]), read)).toEqual([]);
  await expect(all(statement([stored, { id: "b" }]), read)).rejects.toThrow(
    TypeError,
  );
});
