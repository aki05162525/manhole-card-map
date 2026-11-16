import { appliesLabel } from "./applies";
import { facilityMapLink, lidMapLink, type MapLink } from "./map-links";
import type { Card, Data, Status } from "./types";

type Place = Data["places"][number];
type Relation = Data["relations"][number];

/** One place a visitor can choose to receive the card at. */
export type Counter = {
  relation: Relation;
  place: Place;
  /** When this counter serves ("平日"); empty without a typed condition. */
  when: string;
  name: string;
  status: Status;
  hours: string[] | null;
  paused: boolean;
  /** Null when there is nothing to hand to Google Maps. */
  link: MapLink | null;
};

export const isPaused = (status: Status | undefined) =>
  status === "ended" || status === "suspended";

/**
 * The card's counters, the one at `firstPlaceId` first. A relation the ledger
 * repeats word for word is one counter, and counters that would read the same
 * are numbered, so no two rows of the list look alike.
 */
export function cardCounters(
  data: Data,
  card: Card,
  firstPlaceId?: string,
): Counter[] {
  const relations = data.relations.filter(
    (relation) => relation.cardId === card.id,
  );
  const places = new Set(relations.map((relation) => relation.placeId)).size;
  const seen = new Set<string>();
  const counters: Counter[] = [];
  for (const relation of relations) {
    const place = data.places.find((item) => item.id === relation.placeId);
    if (!place) continue;
    const shown = JSON.stringify([
      relation.placeId,
      relation.applies,
      relation.condition,
      relation.periodRaw,
      relation.alternativeRaw,
      relation.hours,
      relation.status,
      relation.validFrom,
      relation.validTo,
      relation.review,
    ]);
    if (seen.has(shown)) continue;
    seen.add(shown);
    const paused = isPaused(card.status) || isPaused(relation.status);
    counters.push({
      relation,
      place,
      when: relation.applies
        ? appliesLabel(
            relation.applies,
            (id) => data.places.find((item) => item.id === id)?.name || id,
          )
        : "",
      name: place.name.trim() || "名称未確認の配布場所",
      status: isPaused(card.status)
        ? card.status
        : relation.status || card.status,
      hours: relation.hours?.length
        ? relation.hours
        : places === 1
          ? card.hours
          : null,
      paused,
      link: facilityMapLink(place, relation, paused),
    });
  }
  const label = (counter: Counter) => `${counter.when}\n${counter.name}`;
  const count = new Map<string, number>();
  for (const counter of counters)
    count.set(label(counter), (count.get(label(counter)) ?? 0) + 1);
  const next = new Map<string, number>();
  for (const counter of counters) {
    const key = label(counter);
    if (count.get(key) === 1) continue;
    const number = (next.get(key) ?? 0) + 1;
    next.set(key, number);
    counter.name = `${counter.name}（${number}）`;
  }
  return counters.sort(
    (a, b) =>
      Number(b.place.id === firstPlaceId) - Number(a.place.id === firstPlaceId),
  );
}

/**
 * Whether a detail starts at "② 蓋を訪ねる". A tapped pin stays the
 * destination. Opened any other way, a card that can no longer be received,
 * or has no place to receive it, starts at its lid.
 */
export function opensAtLid(data: Data, card: Card, tappedPinId?: string) {
  return (
    !tappedPinId &&
    lidMapLink(card.lid) !== null &&
    (card.status === "ended" ||
      !data.relations.some(
        (relation) =>
          relation.cardId === card.id &&
          data.places.some((place) => place.id === relation.placeId),
      ))
  );
}
