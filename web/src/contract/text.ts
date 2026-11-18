const graphemes = new Intl.Segmenter("ja", { granularity: "grapheme" });

// Counts what a person sees as characters, stopping once past `max`.
export function graphemeCount(text: string, max = Infinity) {
  let count = 0;
  for (const _ of graphemes.segment(text)) if (++count > max) break;
  return count;
}

export const longerThan = (text: string, max: number) =>
  graphemeCount(text, max) > max;
