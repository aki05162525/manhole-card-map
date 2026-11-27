import { areas, prefectures } from "../prefectures.ts";
import { pinsView } from "./public-views.ts";
import type { Data } from "./types.ts";

/** Cards per prefecture (by name) and per area (by id). */
export type LevelCounts = {
  prefs: Record<string, number>;
  areas: Record<string, number>;
};

/**
 * Cards per prefecture and area. A card at several facilities has a pin at
 * each, so count distinct card IDs rather than pins. A facility counts where
 * it stands (`pin.pref`), whichever prefecture numbered its cards.
 */
export function countPins(
  pins: { pref: string; cardIds: string[] }[],
): LevelCounts {
  const prefCards = new Map<string, Set<string>>();
  const areaCards = new Map<string, Set<string>>();
  const add = (sets: Map<string, Set<string>>, key: string, id: string) => {
    const set = sets.get(key) ?? new Set<string>();
    set.add(id);
    sets.set(key, set);
  };
  for (const pin of pins) {
    const p = prefectures.find((p) => p.name === pin.pref);
    if (!p) continue;
    for (const id of pin.cardIds) {
      add(prefCards, p.name, id);
      add(areaCards, p.area, id);
    }
  }
  return {
    prefs: Object.fromEntries(
      prefectures.map((p) => [p.name, prefCards.get(p.name)?.size ?? 0]),
    ),
    areas: Object.fromEntries(
      areas.map((a) => [a.id, areaCards.get(a.id)?.size ?? 0]),
    ),
  };
}

/**
 * What the map's first view shows before any data file: the public counts of
 * the national and regional levels, and the detail files there are. The
 * build counts them from the same data it serves (`vite.config.ts`), so the
 * map need not read every pin to number its levels.
 */
export type MapSummary = { counts: LevelCounts; shards: string[] };
export function summarizeMap(data: Data): MapSummary {
  const view = pinsView(data);
  return {
    counts: countPins(view.pins.filter((pin) => pin.kind === "place")),
    shards: view.shards,
  };
}

/** The summary as the build writes it on the map's `#root`. */
export function mapSummaryAttributes({ counts, shards }: MapSummary) {
  const prefs = prefectures
    .map((pref) => `${pref.code}:${counts.prefs[pref.name] ?? 0}`)
    .join(",");
  const areaCounts = areas
    .map((area) => `${area.id}:${counts.areas[area.id] ?? 0}`)
    .join(",");
  return `data-pref-counts="${prefs}" data-area-counts="${areaCounts}" data-detail-shards="${shards.join(",")}"`;
}

const pairs = (text: string) =>
  new Map(
    text.split(",").flatMap((entry) => {
      const [key, value] = entry.split(":");
      const count = Number(value);
      return key && Number.isInteger(count) ? [[key, count] as const] : [];
    }),
  );
/** The summary back from those attributes; a page built without them has none. */
export function readMapSummary(
  dataset: Readonly<Record<string, string | undefined>>,
): MapSummary | undefined {
  const { prefCounts, areaCounts, detailShards } = dataset;
  if (
    prefCounts === undefined ||
    areaCounts === undefined ||
    detailShards === undefined
  )
    return undefined;
  const prefs = pairs(prefCounts);
  const areaValues = pairs(areaCounts);
  if (
    !prefectures.every((pref) => prefs.has(pref.code)) ||
    !areas.every((area) => areaValues.has(area.id))
  )
    return undefined;
  return {
    counts: {
      prefs: Object.fromEntries(
        prefectures.map((pref) => [pref.name, prefs.get(pref.code)!]),
      ),
      areas: Object.fromEntries(
        areas.map((area) => [area.id, areaValues.get(area.id)!]),
      ),
    },
    shards: detailShards ? detailShards.split(",") : [],
  };
}
