import { prefectures } from "../prefectures.ts";
import type { Card, Data } from "./types.ts";

export const OTHER_PREF = "other";
const prefByName = new Map(prefectures.map((pref) => [pref.name, pref]));
export function catalogPrefCode(card: Pick<Card, "pref">): string {
  return prefByName.get(card.pref)?.code ?? OTHER_PREF;
}

/** The catalog's first view, counted at build time from the data it ships. */
export type CatalogSummary = {
  evaluatedAt: string;
  /** Cards per prefecture code, and `other`. */
  totals: Record<string, number>;
};
export function summarizeCatalog(
  data: Pick<Data, "cards" | "evaluatedAt">,
): CatalogSummary {
  const totals: Record<string, number> = { [OTHER_PREF]: 0 };
  for (const pref of prefectures) totals[pref.code] = 0;
  for (const card of data.cards) totals[catalogPrefCode(card)]++;
  return { evaluatedAt: data.evaluatedAt ?? "", totals };
}

const escape = (value: string) =>
  value.replaceAll("&", "&amp;").replaceAll('"', "&quot;");
/** Replaces the root's `data-catalog-summary` marker, as about's summary does. */
export function embedCatalogSummary(html: string, summary: CatalogSummary) {
  const totals = [...prefectures.map((pref) => pref.code), OTHER_PREF]
    .map((code) => `${code}:${summary.totals[code] ?? 0}`)
    .join(",");
  return html.replace(
    "data-catalog-summary",
    `data-catalog-totals="${totals}" data-evaluated-at="${escape(summary.evaluatedAt)}"`,
  );
}
export function readCatalogSummary(
  dataset: Readonly<Record<string, string | undefined>>,
): CatalogSummary | undefined {
  if (dataset.catalogTotals === undefined) return undefined;
  return {
    evaluatedAt: dataset.evaluatedAt ?? "",
    totals: Object.fromEntries(
      dataset.catalogTotals.split(",").map((entry) => {
        const [code, total] = entry.split(":");
        return [code, Number(total)];
      }),
    ),
  };
}
