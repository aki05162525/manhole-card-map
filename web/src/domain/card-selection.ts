import type { Card, Data, Pin } from "./types";

// Loaded data is replaced as a unit. Weak keys let old datasets and cards be collected.
type SearchIndex = {
  destinations: ReadonlyMap<string, string>;
  texts: WeakMap<Card, string>;
};
const searchIndexes = new WeakMap<Data, SearchIndex>();
const standaloneIndex: SearchIndex = {
  destinations: new Map(),
  texts: new WeakMap(),
};
function searchIndex(data: Data): SearchIndex {
  const cached = searchIndexes.get(data);
  if (cached) return cached;
  const places = new Map(
    data.places.map((place) => [place.id, `${place.name} ${place.address}`]),
  );
  const destinations = new Map<string, string[]>();
  for (const relation of data.relations) {
    const terms = destinations.get(relation.cardId) || [];
    terms.push(places.get(relation.placeId) || "");
    destinations.set(relation.cardId, terms);
  }
  const index = {
    destinations: new Map(
      [...destinations].map(([id, terms]) => [id, terms.join(" ")]),
    ),
    texts: new WeakMap<Card, string>(),
  };
  searchIndexes.set(data, index);
  return index;
}
function cardSearchText(card: Card, index: SearchIndex): string {
  const cached = index.texts.get(card);
  if (cached !== undefined) return cached;
  const text =
    `${card.pref} ${card.city} ${card.id} ${index.destinations.get(card.id) || ""}`.toLocaleLowerCase();
  index.texts.set(card, text);
  return text;
}
export function matchingCards(
  cards: Card[],
  query: string,
  data?: Data,
): Card[] {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const index = data ? searchIndex(data) : standaloneIndex;
  const matches = cards.filter((card) => {
    const text = cardSearchText(card, index);
    return terms.every((term) => text.includes(term));
  });
  if (!terms.length) return matches;
  const municipality = terms.join(" ");
  const rank = (card: Card) => {
    const city = card.city.toLocaleLowerCase();
    return city === municipality
      ? 0
      : city.startsWith(municipality)
        ? 1
        : city.includes(municipality)
          ? 2
          : 3;
  };
  // Stable sorting retains the catalog's prefecture-code / card-number order.
  return matches.sort((a, b) => rank(a) - rank(b));
}

export function selectionPins(pins: Pin[], ids: string[]): Pin[] {
  const selected = new Set(ids);
  return pins.filter((pin) => pin.cardIds.some((id) => selected.has(id)));
}

// Never substitute a lid or a geocoding candidate for a confirmed destination.
export function visiblePins(
  data: Data | null,
  showLids: boolean,
  revealedCardId?: string,
): Pin[] {
  if (!data) return [];
  const confirmed = new Set(
    data.places
      .filter(
        (place) =>
          place.coordinate.status === "confirmed" &&
          (!place.locationReview ||
            (place.locationReview.status === "confirmed" &&
              place.locationReview.addressStatus === "valid")),
      )
      .map((place) => place.id),
  );
  return data.pins.filter(
    (pin) =>
      !pin.reference &&
      (pin.kind === "place"
        ? confirmed.has(pin.id)
        : showLids ||
          Boolean(revealedCardId && pin.cardIds.includes(revealedCardId))),
  );
}

export function prefectureCards(data: Data | null, pref: string) {
  const cards = (data?.cards ?? []).filter((card) => card.pref === pref);
  const mapped = new Set(
    visiblePins(data, false).flatMap((pin) => pin.cardIds),
  );
  const visible = cards.filter((card) => mapped.has(card.id)).length;
  return {
    cards,
    total: cards.length,
    visible,
    unknown: cards.length - visible,
  };
}

export function cardsForIds(
  cards: ReadonlyMap<string, Card>,
  ids: string[],
): Card[] {
  return [...new Set(ids)].flatMap((id) => {
    const card = cards.get(id);
    return card ? [card] : [];
  });
}

export function detailCard(
  group: Card[],
  selectedId?: string,
): Card | undefined {
  return selectedId
    ? group.find((card) => card.id === selectedId)
    : group.length === 1
      ? group[0]
      : undefined;
}

/** Explain a hidden destination match without replacing an already visible match. */
export function searchResultExcerpt(
  visible: readonly string[],
  candidates: readonly string[],
  query: string,
): string | null {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  if (
    !terms.length ||
    visible.some((text) =>
      terms.some((term) => text.toLocaleLowerCase().includes(term)),
    )
  )
    return null;
  for (const text of candidates) {
    const lower = text.toLocaleLowerCase();
    const matches = terms
      .map((term) => ({ start: lower.indexOf(term), length: term.length }))
      .filter((match) => match.start >= 0);
    if (!matches.length) continue;
    const match = matches.reduce((first, next) =>
      next.start < first.start ? next : first,
    );
    const start = Math.max(0, match.start - 12);
    const end = Math.min(text.length, match.start + match.length + 12);
    return `${start ? "…" : ""}${text.slice(start, end)}${end < text.length ? "…" : ""}`;
  }
  return null;
}
