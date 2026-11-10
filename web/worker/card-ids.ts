import cardIds from "../../data/card-ids.json";

// Old official numbers mapped straight to the current ones; never chained
// (DA-2, docs/data-maintenance.md).
const aliases: Record<string, string> = cardIds.aliases;

export const currentCardId = (id: string, map = aliases) => map[id] ?? id;

type CardRecord = { cardId: string; receivedOn: string | null };

// Sorted by current number. Should an old and a new number both be recorded,
// the card counts once and the record under the current number wins (DA-4
// stops such merges, so this only guards the count).
export function currentRecords(records: CardRecord[], map = aliases) {
  const cards = new Map<string, string | null>();
  for (const { cardId, receivedOn } of records) {
    const current = currentCardId(cardId, map);
    if (!cards.has(current) || current === cardId)
      cards.set(current, receivedOn);
  }
  return [...cards]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([cardId, receivedOn]) => ({ cardId, receivedOn }));
}
