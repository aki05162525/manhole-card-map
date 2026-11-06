import type { Card, Data, Pin, View } from "./types";

export function matchingCards(
  cards: Card[],
  query: string,
  data?: Data,
): Card[] {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const places = new Map(
    data?.places.map((place) => [place.id, `${place.name} ${place.address}`]) ||
      [],
  );
  const destinations = new Map<string, string[]>();
  for (const relation of data?.relations || []) {
    const terms = destinations.get(relation.cardId) || [];
    terms.push(places.get(relation.placeId) || "");
    destinations.set(relation.cardId, terms);
  }
  return cards.filter((card) => {
    const text =
      `${card.pref} ${card.city} ${card.id} ${(destinations.get(card.id) || []).join(" ")}`.toLocaleLowerCase();
    return terms.every((term) => text.includes(term));
  });
}

// Saved camera policy, deliberately narrower than geographic coordinates (±90).
// This is not MapLibre’s exact Mercator projection limit. Never clamp source data.
const MAX_STORED_VIEW_LATITUDE = 85;

export function parseStoredView(value: string | null): View | null {
  try {
    const view = JSON.parse(value || "null");
    return view &&
      [view.lat, view.lng, view.zoom].every(Number.isFinite) &&
      Math.abs(view.lat) <= MAX_STORED_VIEW_LATITUDE &&
      Math.abs(view.lng) <= 180 &&
      view.zoom >= 0 &&
      view.zoom <= 18
      ? { lat: view.lat, lng: view.lng, zoom: view.zoom }
      : null;
  } catch {
    return null;
  }
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

// Initial browser history entries have no application state.
export function focusFromHistory(
  state: { mapFocus?: import("./map-levels").MapFocus } | null,
) {
  return state?.mapFocus ?? { area: null, pref: null };
}
