import type { Data } from "../../domain/types.ts";

export type AboutSummary = {
  cardCount: number;
  placeCount: number;
  asOf: string;
  fixture: boolean;
};

export function summarizeAbout(
  data: Pick<Data, "cards" | "pins" | "updated" | "evaluatedAt"> & {
    fixture?: boolean;
  },
): AboutSummary {
  const asOf = data.evaluatedAt || data.updated;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(asOf))
    throw new Error("Invalid about reference date");
  return {
    cardCount: data.cards.length,
    placeCount: data.pins.filter((pin) => pin.kind === "place").length,
    asOf,
    fixture: data.fixture === true,
  };
}

/**
 * The numbers as the build writes them on a page's `#root` (`vite.config.ts`):
 * about's own and every screen about can be switched to from.
 */
export const aboutAttributes = (summary: AboutSummary) =>
  `data-card-count="${summary.cardCount}" data-place-count="${summary.placeCount}" data-as-of="${summary.asOf}" data-fixture="${summary.fixture}"`;
/** The numbers back from those attributes; a page built without them has none. */
export function readAboutSummary(
  data: Record<string, string | undefined>,
): AboutSummary | undefined {
  return data.asOf
    ? {
        cardCount: Number(data.cardCount),
        placeCount: Number(data.placeCount),
        asOf: data.asOf,
        fixture: data.fixture === "true",
      }
    : undefined;
}
