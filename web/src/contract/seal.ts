import { isString, nullable, shape, type Guard } from "./shape";
import { firstGrapheme } from "./text";

// The seal a user is shown with beside their name, as a name stamp is
// pressed on a notebook: a frame, an ink, and one character. The lists are
// the choices the settings offer, in the order they offer them.
export const SEAL_FRAMES = [
  "double",
  "round",
  "oval",
  "square",
  "octagon",
  "cover",
] as const;
export const SEAL_INKS = [
  "vermilion",
  "indigo",
  "patina",
  "purple",
  "sumi",
] as const;
export type SealFrame = (typeof SEAL_FRAMES)[number];
export type SealInk = (typeof SEAL_INKS)[number];
/** `char` null: the first character of the display name, whatever it becomes. */
export type Seal = { frame: SealFrame; ink: SealInk; char: string | null };

const oneOf =
  <const T extends readonly string[]>(values: T): Guard<T[number]> =>
  (value): value is T[number] =>
    typeof value === "string" && values.includes(value);
export const isSealFrame = oneOf(SEAL_FRAMES);
export const isSealInk = oneOf(SEAL_INKS);
export const isSeal = shape<Seal>({
  frame: isSealFrame,
  ink: isSealInk,
  char: nullable(isString),
});

/** The seal of a user who has chosen none. An answer leaves it out. */
export const DEFAULT_SEAL: Seal = {
  frame: "double",
  ink: "vermilion",
  char: null,
};
export const isDefaultSeal = (seal: Seal) =>
  seal.frame === DEFAULT_SEAL.frame &&
  seal.ink === DEFAULT_SEAL.ink &&
  seal.char === null;

/** The character the seal shows for the user of that name. */
export const sealCharacter = (seal: Seal, name: string) =>
  seal.char ?? firstGrapheme(name);
