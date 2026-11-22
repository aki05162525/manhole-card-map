import { createCardCatalog, type PinReason } from "./card-catalog.ts";
import { visiblePins } from "./card-selection.ts";
import type { Card, Data, Pin } from "./types.ts";

// What the pages read of one data generation. The catalog reads it whole
// (`full.json`); the map reads these views of it, which the build cuts from
// the same data (`scripts/build/served-data.ts`): its pins to start with,
// the national search index when the search opens, and one prefecture's
// details when a card or a pin of that prefecture is chosen.
type Envelope = Pick<Data, "schema" | "updated" | "evaluatedAt">;
export type PinsFile = Envelope &
  Pick<Data, "cardAliases"> & {
    /** The detail files there are, by `detailShard`. */
    shards: string[];
    pins: Pin[];
  };
export type DetailFile = Envelope &
  Pick<Data, "cards" | "places" | "relations">;
/** One card as the search shows it, in the catalog's order. */
export type SearchCard = Pick<Card, "id" | "city" | "pref" | "status"> & {
  /** Where it is handed out: searched, and shown when it explains a match. */
  places: { name: string; address: string }[];
  hasPin: boolean;
  pinReasons: PinReason[];
};
export type SearchFile = Envelope & { cards: SearchCard[] };

/**
 * The detail file a card is in: its number's prefecture code, which is "00"
 * for an issuer outside the prefectures. Known from the number alone, so a
 * card's URL asks for its details without waiting for anything else.
 */
export const detailShard = (cardId: string): string =>
  /^(\d{2})-/.exec(cardId)?.[1] ?? "00";

const envelope = (data: Envelope): Envelope => ({
  schema: data.schema,
  updated: data.updated,
  ...(data.evaluatedAt ? { evaluatedAt: data.evaluatedAt } : {}),
});

/**
 * The map's first file. The map draws these pins without the places they
 * stand on, so a place whose position is not confirmed, or was withdrawn in
 * review, has no pin here.
 */
export function pinsView(data: Data): PinsFile {
  return {
    ...envelope(data),
    ...(data.cardAliases ? { cardAliases: data.cardAliases } : {}),
    shards: [...new Set(data.cards.map((card) => detailShard(card.id)))].sort(),
    pins: visiblePins(data, true),
  };
}

/** The national search index: each card with where it is handed out. */
export function searchView(data: Data): SearchFile {
  const catalog = createCardCatalog(data);
  return {
    ...envelope(data),
    cards: catalog.cards.map(({ id, city, pref, status }) => {
      const entry = catalog.entriesById.get(id)!;
      return {
        id,
        city,
        pref,
        status,
        places: entry.places.map(({ name, address }) => ({ name, address })),
        hasPin: entry.hasPin,
        pinReasons: entry.pinReasons,
      };
    }),
  };
}

/** Every view by its file name: `pins.json`, `search.json`, `detail-13.json`. */
export function publicViews(
  data: Data,
): Record<string, PinsFile | SearchFile | DetailFile> {
  const shards = new Map<string, DetailFile>();
  const shardOf = new Map<string, DetailFile>();
  for (const card of data.cards) {
    const key = detailShard(card.id);
    let shard = shards.get(key);
    if (!shard) {
      shard = { ...envelope(data), cards: [], places: [], relations: [] };
      shards.set(key, shard);
    }
    shard.cards.push(card);
    shardOf.set(card.id, shard);
  }
  const placesById = new Map(data.places.map((place) => [place.id, place]));
  const placed = new Map<DetailFile, Set<string>>();
  for (const relation of data.relations) {
    const shard = shardOf.get(relation.cardId);
    if (!shard) throw new Error(`カードのない配布関係: ${relation.cardId}`);
    shard.relations.push(relation);
    // A place two prefectures' cards share is in both files.
    const place = placesById.get(relation.placeId);
    const seen = placed.get(shard) ?? new Set<string>();
    placed.set(shard, seen);
    if (place && !seen.has(place.id)) {
      seen.add(place.id);
      shard.places.push(place);
    }
  }
  return {
    "pins.json": pinsView(data),
    "search.json": searchView(data),
    ...Object.fromEntries(
      [...shards].map(([key, shard]) => [`detail-${key}.json`, shard]),
    ),
  };
}

/** One `Data` of the details received, for the cards they hold. */
export function detailData(pins: PinsFile, parts: DetailFile[]): Data {
  const cards = parts.flatMap((part) => part.cards);
  const ids = new Set(cards.map((card) => card.id));
  const places = new Map(
    parts.flatMap((part) => part.places).map((place) => [place.id, place]),
  );
  return {
    ...envelope(pins),
    ...(pins.cardAliases ? { cardAliases: pins.cardAliases } : {}),
    cards,
    places: [...places.values()],
    relations: parts.flatMap((part) => part.relations),
    pins: pins.pins.filter((pin) => pin.cardIds.some((id) => ids.has(id))),
  };
}
