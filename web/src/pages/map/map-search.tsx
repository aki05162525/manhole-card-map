import { SiteMenu } from "../../shared/ui/site-menu";
import { useRecords } from "../../features/records/records-context";
import { RecordFilter } from "../../features/records/records-entry";
import { ArrowLeft, X } from "lucide-react";
import { BarLogo, EntryContent, SEARCH_ENTRY_LABEL } from "./search-bar-parts";
import { useEffect, useId, useMemo, useState } from "react";
import { catalogUrl } from "../../shared/url/catalog-url";
import { matchingSearchCards } from "../../domain/card-selection";
import { SEARCH_PAGE, type MapSearchSession } from "./map-search-state";
import { SearchResultRow } from "./search-result-row";
import { useSearchDialog } from "./use-search-dialog";
import {
  SearchEmptyState,
  SearchSkeleton,
  SEARCH_PLACEHOLDER,
} from "../../shared/ui/search-feedback";
import { Delayed } from "../../shared/ui/delayed";
import type { SearchCard, SearchFile } from "../../domain/public-views";
import { narrowScreen, WIDE_QUERY } from "../../features/map/screen-shape";
import "./map-search.css";

export type MapSearchProps = {
  /** The national search index; null until it has been read. */
  index: SearchFile | null;
  dataError: string;
  /** The way out of `dataError`, and what its button says. */
  onRetry: () => void;
  retryLabel?: string;
  /** The prefecture the map is on, which the list opens at. */
  pref: string | undefined;
  session: MapSearchSession;
  onSelect: (card: SearchCard) => void;
  onOpen: () => void;
  onClose: () => void;
  /** The dialog's exit has finished. */
  onClosed: () => void;
  onUpdate: (patch: Partial<MapSearchSession>) => void;
};

export function MapSearch({
  index,
  dataError,
  onRetry,
  retryLabel = "再試行",
  pref,
  session,
  onSelect,
  onOpen,
  onClose,
  onClosed,
  onUpdate,
}: MapSearchProps) {
  const { dialog, input, scroller, heading, entry, dismissal, resetScroll } =
    useSearchDialog({ session, onClose, onClosed });
  // While an input method composes, the count stays as it was at its start.
  const [held, setHeld] = useState<string | null>(null);
  const [desktop, setDesktop] = useState(
    () =>
      typeof window !== "undefined" &&
      (window.matchMedia?.(WIDE_QUERY).matches ??
        !narrowScreen(window.innerWidth)),
  );
  useEffect(() => {
    const media = window.matchMedia?.(WIDE_QUERY);
    if (!media) return;
    const update = () => setDesktop(media.matches);
    update();
    media.addEventListener?.("change", update);
    return () => media.removeEventListener?.("change", update);
  }, []);
  const id = useId();
  const records = /* @__PURE__ */ useRecords();
  const matchReceipt =
    import.meta.env.VITE_ACCOUNTS_ENABLED === "true"
      ? records.matches
      : undefined;
  const results = useMemo(() => {
    if (!index || !session.query.trim()) return [];
    const cards = matchingSearchCards(index.cards, session.query);
    return matchReceipt ? cards.filter((card) => matchReceipt(card.id)) : cards;
  }, [index, session.query, matchReceipt]);
  const empty = Boolean(
    index && !dataError && session.query.trim() && !results.length,
  );
  // Until the data arrives, a loading line shows only once the wait is long.
  const message = dataError
    ? dataError
    : !index
      ? ""
      : session.query.trim()
        ? results.length > session.limit
          ? `${session.limit}件を表示中 · 全${results.length}件`
          : empty
            ? ""
            : `${results.length}件`
        : "";
  const changeQuery = (query: string) => {
    onUpdate({ query, limit: SEARCH_PAGE, scroll: 0, selected: null });
    resetScroll();
  };
  const pick = (card: SearchCard) => {
    onUpdate({
      selected: card.id,
      restore: true,
      scroll: scroller.current?.scrollTop ?? 0,
    });
    onSelect(card);
  };
  const listUrl = catalogUrl({
    pref: pref ?? null,
    q: "",
    page: 1,
    card: null,
  });
  // A wide screen starts the bar with the menu; a phone ends it with it.
  const menu = (
    <SiteMenu
      current="map"
      listHref={listUrl}
      align={desktop ? "start" : "end"}
    />
  );
  return (
    <>
      <header className="map-search-bar">
        {desktop && menu}
        <BarLogo />
        <button
          ref={entry}
          className="map-search-entry"
          type="button"
          aria-label="カードを検索"
          onClick={onOpen}
        >
          <EntryContent text={session.query || SEARCH_ENTRY_LABEL} />
        </button>
        {session.query && session.phase === "map" && (
          <button
            className="map-search-clear"
            type="button"
            aria-label="検索語を消す"
            onClick={() => changeQuery("")}
          >
            <X size={20} aria-hidden="true" />
          </button>
        )}
        {!desktop && menu}
      </header>
      <dialog
        ref={dialog}
        className={`map-search-dialog ${desktop ? "map-search-panel" : "map-search-fullscreen"}`}
        {...{ closedby: "any" }}
        aria-label="カード検索"
        {...dismissal}
      >
        <div className="map-search-content search-controls">
          <search className="map-search-input-row search-input-line">
            <button type="button" aria-label="検索を閉じる" onClick={onClose}>
              <ArrowLeft aria-hidden="true" />
            </button>
            <label className="map-search-sr-only" htmlFor={id}>
              {SEARCH_ENTRY_LABEL}
            </label>
            <input
              ref={input}
              id={id}
              type="search"
              autoComplete="off"
              enterKeyHint="search"
              value={session.query}
              placeholder={SEARCH_PLACEHOLDER}
              onChange={(event) => changeQuery(event.target.value)}
              onCompositionStart={() => setHeld(message)}
              onCompositionEnd={() => setHeld(null)}
              onKeyDown={(event) => {
                if (
                  event.key === "Enter" &&
                  !event.nativeEvent.isComposing &&
                  // Safari can deliver compositionend before this keydown.
                  event.nativeEvent.keyCode !== 229 &&
                  held === null
                ) {
                  event.preventDefault();
                  input.current?.blur();
                  heading.current?.focus();
                }
              }}
            />
            {session.query && (
              <button
                type="button"
                aria-label="検索語を消す"
                onClick={() => {
                  changeQuery("");
                  input.current?.focus();
                }}
              >
                <X aria-hidden="true" />
              </button>
            )}
          </search>
          <div ref={scroller} className="map-search-results">
            {import.meta.env.VITE_ACCOUNTS_ENABLED === "true" && (
              <RecordFilter />
            )}
            {!empty && (
              <h2 ref={heading} tabIndex={-1}>
                {session.query.trim() ? "検索結果" : "探し方"}
              </h2>
            )}
            <div
              role={empty ? undefined : "status"}
              aria-live={empty ? undefined : "polite"}
              aria-atomic={empty ? undefined : true}
            >
              {empty ? (
                <SearchEmptyState
                  query={session.query.trim()}
                  regionHref={listUrl}
                  headingRef={heading}
                />
              ) : (
                <p>
                  {held ?? message}
                  {!index && !dataError && <Delayed>読み込み中</Delayed>}
                </p>
              )}
            </div>
            {dataError ? (
              <div className="map-search-error">
                <p>{dataError}</p>
                <button type="button" onClick={onRetry}>
                  {retryLabel}
                </button>
              </div>
            ) : !index && session.query.trim() ? (
              <SearchSkeleton />
            ) : index && session.query.trim() ? (
              <>
                <ul>
                  {results.slice(0, session.limit).map((card) => (
                    <SearchResultRow
                      key={card.id}
                      card={card}
                      query={session.query}
                      onPick={pick}
                    />
                  ))}
                </ul>
                {results.length > session.limit && (
                  <button
                    type="button"
                    className="search-more"
                    onClick={() =>
                      onUpdate({ limit: session.limit + SEARCH_PAGE })
                    }
                  >
                    さらに
                    {Math.min(SEARCH_PAGE, results.length - session.limit)}
                    件表示
                  </button>
                )}
              </>
            ) : (
              !session.query.trim() && (
                <>
                  <p>漢字の自治体名・施設名・県名・番号の一部で探せます</p>
                  <button
                    type="button"
                    className="search-example"
                    onClick={() => {
                      changeQuery("三島");
                      input.current?.focus();
                    }}
                  >
                    例: 三島
                  </button>
                  <a className="search-region-link" href={listUrl}>
                    地域から探す
                  </a>
                </>
              )
            )}
          </div>
        </div>
      </dialog>
    </>
  );
}
