import type { D1PreparedStatement } from "./env";

// The columns a statement returns, by SQLite type; "?" allows NULL, and a
// list is a TEXT column held to those values. The tables are STRICT, so this
// checks that the statement selects what the code reads (a renamed column, a
// missing alias), not what SQLite stored.
type Type = "text" | "integer" | "text?" | "integer?" | "blob";
type Column = Type | readonly string[];
type Values = {
  text: string;
  integer: number;
  "text?": string | null;
  "integer?": number | null;
  // D1 hands BLOBs back as an ArrayBuffer or, through some clients, an array.
  blob: ArrayBuffer | Uint8Array | number[];
};
type Shape = Record<string, Column>;
type Value<C extends Column> = C extends Type
  ? Values[C]
  : C extends readonly (infer L)[]
    ? L
    : never;
type Row<S extends Shape> = { [K in keyof S]: Value<S[K]> };
export type Read<T> = (value: unknown) => T;
// The row a reader returns.
export type RowOf<R extends Read<unknown>> = ReturnType<R>;

const fits: { [C in Type]: (value: unknown) => boolean } = {
  text: (value) => typeof value === "string",
  integer: (value) => Number.isInteger(value),
  "text?": (value) => value === null || typeof value === "string",
  "integer?": (value) => value === null || Number.isInteger(value),
  blob: (value) =>
    value instanceof ArrayBuffer ||
    value instanceof Uint8Array ||
    (Array.isArray(value) && value.every((byte) => typeof byte === "number")),
};

const isRow = <S extends Shape>(shape: S, value: unknown): value is Row<S> =>
  typeof value === "object" &&
  value !== null &&
  Object.entries(shape).every(([key, column]) =>
    typeof column === "string"
      ? fits[column](Reflect.get(value, key))
      : column.includes(Reflect.get(value, key)),
  );

export class D1RowShapeError extends TypeError {
  override name = "D1RowShapeError";
}

// Reads one row of the given shape, or fails the request with a 500.
export const columns =
  <const S extends Shape>(shape: S): Read<Row<S>> =>
  (value) => {
    if (!isRow(shape, value))
      throw new D1RowShapeError("D1 returned a row of another shape");
    return value;
  };

export const rows = <T>(read: Read<T>, results: unknown[]) => results.map(read);

// One round trip each, as `first` and `all` themselves.
export async function first<T>(statement: D1PreparedStatement, read: Read<T>) {
  const value = await statement.first();
  return value === null ? null : read(value);
}

export const all = async <T>(statement: D1PreparedStatement, read: Read<T>) =>
  rows(read, (await statement.all()).results);
