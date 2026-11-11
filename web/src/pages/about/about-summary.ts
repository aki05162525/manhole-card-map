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
