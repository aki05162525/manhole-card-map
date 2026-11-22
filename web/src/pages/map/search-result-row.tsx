import type { CatalogEntry } from "../../domain/card-catalog";
import { municipalityName } from "../../domain/card-presentation";
import { searchResultExcerpt } from "../../domain/card-selection";
import type { Card } from "../../domain/types";
import { RecordBadge } from "../../features/records/records-entry";
import { SearchPin } from "../../shared/ui/search-feedback";
import { StatusChip } from "../../shared/ui/status-chip";

/** The text with each of the query's words marked where it occurs. */
function SearchMatch({ text, query }: { text: string; query: string }) {
  const terms = query.trim().split(/\s+/).filter(Boolean);
  if (!terms.length) return text;
  const pattern = new RegExp(
    `(${terms.map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`,
    "gi",
  );
  return text
    .split(pattern)
    .map((part, index) => (index % 2 ? <mark key={index}>{part}</mark> : part));
}

/**
 * One card among the results. Its facility line is the name or address the
 * query matched, when the summary alone would not show why the card is here.
 */
export function SearchResultRow({
  card,
  entry,
  query,
  onPick,
}: {
  card: Card;
  entry: CatalogEntry;
  query: string;
  onPick: (card: Card) => void;
}) {
  const city = municipalityName(card.city);
  const excerpt = searchResultExcerpt(
    [city, card.pref, card.id, entry.facilitySummary],
    entry.places.flatMap((place) => [place.name, place.address]),
    query,
  );
  return (
    <li>
      <button
        type="button"
        data-card={card.id}
        className={
          city.toLocaleLowerCase() === query.trim().toLocaleLowerCase()
            ? "search-row-exact"
            : undefined
        }
        onClick={() => onPick(card)}
      >
        <span className="search-row-heading">
          <span className="search-municipality">
            <strong>
              <SearchMatch text={city} query={query} />
            </strong>
            <span className="search-pref">
              <SearchMatch text={card.pref || "県の登録なし"} query={query} />
            </span>
          </span>
          <StatusChip status={card.status} />
          {import.meta.env.VITE_ACCOUNTS_ENABLED === "true" && (
            <RecordBadge ids={[card.id]} />
          )}
        </span>
        <span className="search-row-meta">
          <span className="search-card-id">
            <SearchMatch text={card.id} query={query} />
          </span>
          <SearchPin entry={entry} />
          <span className="search-facility">
            <SearchMatch
              text={excerpt ?? entry.facilitySummary}
              query={query}
            />
          </span>
        </span>
      </button>
    </li>
  );
}
