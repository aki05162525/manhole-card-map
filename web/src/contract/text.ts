// Made on first use: a module that only imports this must load even where
// Intl.Segmenter is missing, as on the map's first view. A segmenter splits
// by grapheme unless told otherwise.
let graphemes: Intl.Segmenter | null | undefined;
function segmenter() {
  if (graphemes === undefined)
    graphemes =
      typeof Intl.Segmenter === "function" ? new Intl.Segmenter("ja") : null;
  return graphemes;
}

// Counts what a person sees as characters, stopping once past `max`. Without
// Intl.Segmenter (old browsers only; the Worker always has it) it counts code
// points, which never counts fewer, so the screen warns no later than the
// Worker refuses.
export function graphemeCount(text: string, max = Infinity) {
  let count = 0;
  const units = segmenter()?.segment(text) ?? text;
  for (const _ of units) if (++count > max) break;
  return count;
}

export const longerThan = (text: string, max: number) =>
  graphemeCount(text, max) > max;
