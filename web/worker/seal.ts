import {
  isDefaultSeal,
  SEAL_FRAMES,
  SEAL_INKS,
  type Seal,
} from "../src/contract/seal";

// The seal's columns of `users`, named `table` in the statement.
export const sealSql = (table = "users") =>
  `${table}.seal_frame, ${table}.seal_ink, ${table}.seal_char`;
export const sealColumns = {
  seal_frame: SEAL_FRAMES,
  seal_ink: SEAL_INKS,
  seal_char: "text?",
} as const;

// As an answer carries it: left out for the seal of a user who chose none.
export function sealOf(row: {
  seal_frame: Seal["frame"];
  seal_ink: Seal["ink"];
  seal_char: string | null;
}): { seal?: Seal } {
  const seal = {
    frame: row.seal_frame,
    ink: row.seal_ink,
    char: row.seal_char,
  };
  return isDefaultSeal(seal) ? {} : { seal };
}
