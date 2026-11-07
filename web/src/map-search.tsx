import { Info } from "lucide-react";
import { useId, useMemo, useRef, useState } from "react";
import type { CardCatalog } from "./card-catalog";
import { catalogUrl } from "./catalog-url";
import { matchingCards } from "./explorer-state";
import type { Card } from "./types";
import "./map-search.css";

export type MapSearchProps = {
  catalog: CardCatalog | null;
  dataError?: string;
  /** Card selection only; the parent owns detail and map operations. */
  onSelect: (card: Card) => void;
  onReload?: () => void;
  /** Current map prefecture code, used only by the header's catalog link. */
  pref?: string | null;
};

export function mapSearchResults(catalog: CardCatalog | null, query: string) {
  if (!catalog || !query.trim()) return { cards: [], total: 0 };
  const cards = matchingCards(catalog.cards, query, catalog.data);
  return { cards: cards.slice(0, 5), total: cards.length };
}

export function MapSearch({
  catalog,
  dataError = "",
  onSelect,
  onReload = () => window.location.reload(),
  pref = null,
}: MapSearchProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const id = useId();
  const results = useMemo(
    () => mapSearchResults(catalog, query),
    [catalog, query],
  );
  const expanded =
    open && Boolean(query.trim()) && Boolean(catalog) && !dataError;
  const listUrl = (q: string, pref: string | null = null) =>
    catalogUrl({ pref, q, page: 1, card: null });

  return (
    <header className="map-search-header">
      <div className="map-search-brand">
        <span className="map-search-mark" aria-hidden="true">
          ◎
        </span>
        <strong>マンホール手帳</strong>
        <nav aria-label="ページ">
          <a href={listUrl("", pref)}>一覧</a>
          <a
            className="site-info-link"
            href="/about.html"
            aria-label="このサイトについて"
            title="このサイトについて"
          >
            <Info aria-hidden="true" size={20} />
          </a>
        </nav>
      </div>
      <div
        className="map-search"
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget))
            setOpen(false);
        }}
        onKeyDown={(event) => {
          if (event.key !== "Escape") return;
          event.preventDefault();
          event.stopPropagation();
          setOpen(false);
          input.current?.focus();
        }}
      >
        <form
          role="search"
          aria-label="カード検索"
          onSubmit={(event) => {
            event.preventDefault();
            setOpen(Boolean(query.trim()));
          }}
        >
          <label className="map-search-sr-only" htmlFor={id}>
            自治体・施設・カード番号
          </label>
          <input
            ref={input}
            id={id}
            type="search"
            value={query}
            placeholder="自治体・施設・カード番号"
            disabled={Boolean(dataError)}
            aria-expanded={expanded}
            aria-controls={`${id}-results`}
            onChange={(event) => {
              setQuery(event.target.value);
              setOpen(true);
            }}
          />
          <button type="submit" disabled={Boolean(dataError)}>
            検索
          </button>
        </form>
        <p className="map-search-sr-only" aria-live="polite" aria-atomic="true">
          {dataError
            ? "カード情報を読み込めませんでした。"
            : !catalog
              ? "カード情報を読み込み中です。"
              : expanded
                ? `${results.total}件。先頭${results.cards.length}件を表示しています。`
                : ""}
        </p>
        {dataError ? (
          <div className="map-search-error">
            <p>{dataError}</p>
            <button type="button" onClick={onReload}>
              再読み込み
            </button>
          </div>
        ) : (
          <div
            id={`${id}-results`}
            className="map-search-results"
            hidden={!expanded}
          >
            {expanded && (
              <>
                <ul>
                  {results.cards.map((card) => (
                    <li key={card.id}>
                      <button
                        type="button"
                        onClick={(event) => {
                          setOpen(false);
                          input.current?.blur();
                          event.currentTarget.blur();
                          onSelect(card);
                        }}
                      >
                        <span className="map-search-meta">
                          {card.pref || "県の登録なし"}
                        </span>
                        <strong>{card.city}</strong>
                        <span className="map-search-meta">
                          {card.id} · 配布施設ピン
                          {catalog?.entriesById.get(card.id)?.hasPin
                            ? "あり"
                            : "なし"}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
                {!results.total && <p>該当するカードはありません。</p>}
                <a className="map-search-all" href={listUrl(query)}>
                  一覧で全件見る（{results.total}件）
                </a>
              </>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
