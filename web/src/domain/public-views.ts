import { createCardCatalog, type PinReason } from "./card-catalog.ts";
import { visiblePins } from "./card-selection.ts";
import { prefectures } from "../prefectures.ts";
import type { Card, Data, Pin } from "./types.ts";

// What the pages read of one data generation. The catalog reads it whole
// (`full.json`); the map reads these views of it, which the build cuts from
// the same data (`scripts/build/served-data.ts`): its pins to start with,
// the facilities of a prefecture when it is chosen (`places-NN.json`), the
// national search index when the search opens, and one prefecture's details
// when a card or a pin of that prefecture is chosen.
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
/** A facility as a prefecture's own drawing shows it, before the map engine. */
type PlacePin = Pick<Pin, "id" | "cardIds" | "status" | "lat" | "lng"> & {
  name: string;
};
/** A line of a drawing, in [lng, lat] pairs. */
type Line = [number, number][];
/**
 * One prefecture's facilities, by where each one stands (`pin.pref`, the
 * facility's address), never by the prefecture that numbered its cards: a
 * facility several cards share is one pin with all of them. With the lines
 * it shares with its neighbours, which draw it without the map engine.
 */
export type PlacesFile = Envelope & {
  pref: string;
  pins: PlacePin[];
  borders: Line[];
};
/** The shared borders as `tools/map/generate.py` writes them. */
export type Borders = {
  features: { properties: { p: string[] }; geometry: { coordinates: Line } }[];
};

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
 * stand on, so the rule the screens apply with the places (`visiblePins`)
 * is applied here: a pin stands on a place whose position is confirmed.
 * `cmd/builddata` gives no other place a pin, and the ledger refuses a
 * withdrawn position that keeps its coordinates, so this drops nothing from
 * data that came that way.
 */
export function pinsView(data: Data): PinsFile {
  return {
    ...envelope(data),
    ...(data.cardAliases ? { cardAliases: data.cardAliases } : {}),
    shards: [...new Set(data.cards.map((card) => detailShard(card.id)))].sort(),
    pins: visiblePins(data, true),
  };
}

/**
 * Every prefecture's facilities, by its code (`places-13.json`), each with
 * the borders that touch it. A prefecture without a facility has a file all
 * the same, so that choosing it is never a missing file.
 */
function placesViews(
  data: Data,
  borders: Borders = { features: [] },
): Record<string, PlacesFile> {
  const names = new Map(data.places.map((place) => [place.id, place.name]));
  const pins = visiblePins(data, false);
  return Object.fromEntries(
    prefectures.map((pref) => [
      `places-${pref.code}.json`,
      {
        ...envelope(data),
        pref: pref.name,
        pins: pins
          .filter((pin) => pin.kind === "place" && pin.pref === pref.name)
          .map(({ id, cardIds, status, lat, lng }) => ({
            id,
            name: names.get(id) ?? "",
            cardIds,
            status,
            lat,
            lng,
          })),
        borders: borders.features
          .filter((line) => line.properties.p.includes(pref.code))
          .map((line) => line.geometry.coordinates),
      },
    ]),
  );
}

const drawn = new WeakMap<PlacesFile, Pin[]>();
/** The pins a prefecture's file stands for, as the map draws them. */
function placesPins(file: PlacesFile): Pin[] {
  const kept = drawn.get(file);
  if (kept) return kept;
  const pins = file.pins.map(({ id, cardIds, status, lat, lng }): Pin => ({
    id,
    kind: "place",
    pref: file.pref,
    cardIds,
    status,
    lat,
    lng,
  }));
  drawn.set(file, pins);
  return pins;
}

/**
 * The pins a screen works from: every pin (`pins.json`), or, until that is
 * read, those of the prefectures read, `partial`: a card's other places may
 * be missing, so nothing is said of where its pins are not.
 */
export type MapPins = PinsFile & { partial?: true };
export function partialPins(files: PlacesFile[], shards: string[]): MapPins {
  return {
    ...envelope(files[0]),
    shards,
    pins: files.flatMap(placesPins),
    partial: true,
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

/**
 * Every view by its file name: `pins.json`, `search.json`, `detail-13.json`
 * and `places-13.json`.
 */
export function publicViews(
  data: Data,
  borders?: Borders,
): Record<string, PinsFile | SearchFile | DetailFile | PlacesFile> {
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
    ...placesViews(data, borders),
    ...Object.fromEntries(
      [...shards].map(([key, shard]) => [`detail-${key}.json`, shard]),
    ),
  };
}

/** What stands for the pins when they could not be read: none of them. */
export const withoutPins = (part: DetailFile): PinsFile => ({
  ...envelope(part),
  shards: [],
  pins: [],
});

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
