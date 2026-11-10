import registry from "../../data/card-ids.json";

// Bundled once, never fetched from the static assets on a request. Old
// official numbers map straight to the current ones; never chained (DA-2).
const aliases = new Map<string, string>(Object.entries(registry.aliases));
export const excluded = new Set(Object.keys(registry.excluded));
export const active = new Set(
  registry.ids.filter((id) => !aliases.has(id) && !excluded.has(id)),
);
export const canonical = (id: string) => aliases.get(id) ?? id;
// Every stored spelling of a current number, the current one first.
export const spellings = new Map<string, string[]>();
for (const [old, id] of aliases) {
  const group = spellings.get(id) ?? [id];
  group.push(old);
  spellings.set(id, group);
}
// For SQL that counts by current number: `json_each(?)` yields old → new.
export const aliasesJson = JSON.stringify(registry.aliases);

type CardRecord = { cardId: string; receivedOn: string | null };

// Sorted by current number. Should an old and a new number both be recorded,
// the card counts once and the record under the current number wins (DA-4
// stops such merges, so this only guards the count).
export function currentRecords(records: CardRecord[]) {
  const cards = new Map<string, string | null>();
  for (const { cardId, receivedOn } of records) {
    const current = canonical(cardId);
    if (!cards.has(current) || current === cardId)
      cards.set(current, receivedOn);
  }
  return [...cards]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([cardId, receivedOn]) => ({ cardId, receivedOn }));
}
