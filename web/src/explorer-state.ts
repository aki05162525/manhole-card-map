import type { Card, Pin, View } from "./types";

export function matchingCards(cards: Card[], query: string): Card[] {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return cards.filter((card) => {
    const text = `${card.pref} ${card.city} ${card.id}`.toLocaleLowerCase();
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
