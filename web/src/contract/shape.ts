// Checks that a value from outside (a JSON body) has a type's shape. Small on
// purpose (Issue #342: no validation library while the answers are few).
// `shape<T>` asks for one check per key of T, so a field added to a type
// fails to compile until its check is written. Keys T does not name are
// allowed and kept: the Worker may answer more than a screen reads.

export type Guard<T> = (value: unknown) => value is T;

export const isString: Guard<string> = (value) => typeof value === "string";

export const isNumber: Guard<number> = (value): value is number =>
  typeof value === "number" && Number.isFinite(value);

export const nullable =
  <T>(guard: Guard<T>): Guard<T | null> =>
  (value): value is T | null =>
    value === null || guard(value);

export const optional =
  <T>(guard: Guard<T>): Guard<T | undefined> =>
  (value): value is T | undefined =>
    value === undefined || guard(value);

export const arrayOf =
  <T>(guard: Guard<T>): Guard<T[]> =>
  (value): value is T[] =>
    Array.isArray(value) && value.every((item) => guard(item));

export const literal =
  <const T extends string | number | boolean>(expected: T): Guard<T> =>
  (value): value is T =>
    value === expected;

export const shape =
  <T extends object>(fields: { [K in keyof T]-?: Guard<T[K]> }): Guard<T> =>
  (value): value is T =>
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.entries<Guard<unknown>>(fields).every(([key, guard]) =>
      guard(Reflect.get(value, key)),
    );
