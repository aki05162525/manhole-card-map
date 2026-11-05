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

export function parseStoredView(value: string | null): View | null {
  try {
    const view = JSON.parse(value || "null");
    return view &&
      [view.lat, view.lng, view.zoom].every(Number.isFinite) &&
      Math.abs(view.lat) <= 85 &&
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
