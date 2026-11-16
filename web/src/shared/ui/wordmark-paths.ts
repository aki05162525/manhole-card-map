/*
 * 「マンホール手帳」 drawn as lettering: one stroke per line of a character,
 * on a 100-unit height. Shared by the page (logo.tsx) and the share image
 * (scripts/generate-seo-images.mjs).
 */
export const WORDMARK_GLYPHS: readonly (readonly [
  offset: number,
  strokes: readonly string[],
])[] = [
  [0, ["M14 24H84L48 62", "M34 46L60 78"]],
  [110, ["M16 24L34 37", "M14 84C52 80 78 60 86 24"]],
  [220, ["M12 34H88", "M50 12V80q0 8-10 5", "M30 52L16 76", "M70 52L84 76"]],
  [330, ["M12 50H88"]],
  [440, ["M34 16V48C34 68 27 80 12 86", "M58 14V84C76 78 86 68 90 52"]],
  [550, ["M74 12L26 21", "M20 38H80", "M10 58H90", "M50 17V78q0 10-14 6"]],
  [
    660,
    [
      "M26 12V90",
      "M10 36V70",
      "M10 36H42V64q0 6-7 5",
      "M60 12V54",
      "M60 12H104",
      "M60 26H98",
      "M60 40H98",
      "M52 54H110",
      "M64 54V88L78 78",
      "M106 62L88 72",
      "M80 67L108 90",
    ],
  ],
];
/** The drawing's box, with room for the stroke around the letters. */
export const WORDMARK_VIEW_BOX = "-4 -2 784 104";
