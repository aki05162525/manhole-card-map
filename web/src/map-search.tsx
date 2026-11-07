import { ArrowLeft, Info, Search, X } from "lucide-react";
import {
  useEffect,
  useLayoutEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { pinReasonLabels, type CardCatalog } from "./card-catalog";
import { catalogUrl } from "./catalog-url";
import { matchingCards } from "./explorer-state";
import { searchSession, type MapSearchSession } from "./map-search-state";
import { labels, type Card } from "./types";
import "./map-search.css";

export type MapSearchProps = {
  catalog: CardCatalog | null;
  dataError?: string;
  onSelect: (card: Card) => void;
  onReload?: () => void;
  pref?: string | null;
  session?: MapSearchSession;
  onOpen?: () => void;
  onClose?: () => void;
  onUpdate?: (patch: Partial<MapSearchSession>) => void;
};
export function mapSearchResults(catalog: CardCatalog | null, query: string) {
  const cards =
    catalog && query.trim()
      ? matchingCards(catalog.cards, query, catalog.data)
      : [];
  return { cards, total: cards.length };
}
export function MapSearch({
  catalog,
  dataError = "",
  onSelect,
  onReload = () => window.location.reload(),
  pref = null,
  session = searchSession(),
  onOpen,
  onClose,
  onUpdate = () => {},
}: MapSearchProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const entry = useRef<HTMLButtonElement>(null);
  const composing = useRef(false);
  const [announcement, setAnnouncement] = useState("");
  const id = useId();
  const open = session.phase === "search";
  const results = useMemo(
    () => mapSearchResults(catalog, session.query),
    [catalog, session.query],
  );
  useLayoutEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) {
      element.showModal();
      if (scroller.current) scroller.current.scrollTop = session.scroll;
      if (session.restore) {
        input.current?.blur();
        const row = Array.from(
          element.querySelectorAll<HTMLButtonElement>("[data-card]"),
        ).find((node) => node.dataset.card === session.selected);
        (row ?? heading.current)?.focus({ preventScroll: true });
      } else input.current?.focus();
    } else if (!open && element.open) {
      element.close();
      entry.current?.focus({ preventScroll: true });
    }
  }, [open, session.restore, session.scroll, session.selected]);
  useEffect(() => {
    if (!open) return;
    const viewport = window.visualViewport;
    const measure = () => {
      dialog.current?.style.setProperty(
        "--search-height",
        `${viewport?.height ?? window.innerHeight}px`,
      );
      dialog.current?.style.setProperty(
        "--search-top",
        `${viewport?.offsetTop ?? 0}px`,
      );
    };
    measure();
    viewport?.addEventListener("resize", measure);
    viewport?.addEventListener("scroll", measure);
    return () => {
      viewport?.removeEventListener("resize", measure);
      viewport?.removeEventListener("scroll", measure);
    };
  }, [open]);
  const message = dataError
    ? "カード情報を読み込めませんでした。"
    : !catalog
      ? "カード情報を読み込み中です"
      : session.query.trim()
        ? `${results.total}件。先頭${Math.min(session.limit, results.total)}件を表示しています。`
        : "";
  useEffect(() => {
    if (!composing.current) setAnnouncement(message);
  }, [message]);
  const changeQuery = (query: string) => {
    onUpdate({ query, limit: 50, scroll: 0, selected: null });
    if (scroller.current) scroller.current.scrollTop = 0;
  };
  const listUrl = catalogUrl({ pref, q: "", page: 1, card: null });
  return (
    <>
      <header className="map-search-bar">
        <button
          ref={entry}
          className="map-search-entry"
          type="button"
          aria-label="カードを検索"
          onClick={onOpen}
        >
          <Search size={20} aria-hidden="true" />
          <span>{session.query || "自治体・施設・番号で検索"}</span>
        </button>
        {session.query && (
          <button
            className="map-search-clear"
            type="button"
            aria-label="検索語を消す"
            onClick={() => changeQuery("")}
          >
            <X size={20} aria-hidden="true" />
          </button>
        )}
        <a href={listUrl}>一覧</a>
        <a
          className="site-info-link"
          href="/about.html"
          aria-label="このサイトについて"
          title="このサイトについて"
        >
          <Info size={20} aria-hidden="true" />
        </a>
      </header>
      <dialog
        ref={dialog}
        className="map-search-dialog"
        aria-label="カード検索"
        onCancel={(event) => {
          event.preventDefault();
          onClose?.();
        }}
      >
        <div className="map-search-content">
          <div className="map-search-input-row">
            <button type="button" aria-label="検索を閉じる" onClick={onClose}>
              <ArrowLeft aria-hidden="true" />
            </button>
            <label className="map-search-sr-only" htmlFor={id}>
              自治体・施設・カード番号
            </label>
            <input
              ref={input}
              id={id}
              type="search"
              value={session.query}
              placeholder="自治体・施設・カード番号"
              onChange={(event) => changeQuery(event.target.value)}
              onCompositionStart={() => {
                composing.current = true;
              }}
              onCompositionEnd={() => {
                composing.current = false;
                setAnnouncement(message);
              }}
              onKeyDown={(event) => {
                if (
                  event.key === "Enter" &&
                  !event.nativeEvent.isComposing &&
                  !composing.current
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
          </div>
          <div
            ref={scroller}
            className="map-search-results"
            onScroll={(event) =>
              onUpdate({ scroll: event.currentTarget.scrollTop })
            }
          >
            <h2 ref={heading} tabIndex={-1}>
              {session.query.trim() ? "検索結果" : "マンホール手帳"}
            </h2>
            <p aria-live="polite" aria-atomic="true">
              {composing.current ? announcement : message}
            </p>
            {dataError ? (
              <div className="map-search-error">
                <p>{dataError}</p>
                <button type="button" onClick={onReload}>
                  再読み込み
                </button>
              </div>
            ) : catalog && session.query.trim() ? (
              <>
                <ul>
                  {results.cards.slice(0, session.limit).map((card) => {
                    const entry = catalog.entriesById.get(card.id)!;
                    return (
                      <li key={card.id}>
                        <button
                          type="button"
                          data-card={card.id}
                          onClick={() => {
                            onUpdate({ selected: card.id, restore: true });
                            onSelect(card);
                          }}
                        >
                          <strong>
                            {card.pref || "県の登録なし"}・{card.city}
                          </strong>
                          <span>{card.id}</span>
                          <span>{entry.facilitySummary}</span>
                          <span>{labels[card.status]}</span>
                          <span>
                            配布施設ピン{entry.hasPin ? "あり" : "なし"}
                            {entry.pinReasons
                              .map((reason) => ` · ${pinReasonLabels[reason]}`)
                              .join("")}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
                {!results.total && (
                  <p>
                    該当するカードはありません。自治体名・施設名・カード番号を変えてお試しください。
                  </p>
                )}
                {results.total > session.limit && (
                  <button
                    type="button"
                    onClick={() => onUpdate({ limit: session.limit + 50 })}
                  >
                    さらに50件表示
                  </button>
                )}
              </>
            ) : (
              !session.query.trim() && (
                <>
                  <p>自治体・施設・カード番号で検索できます。例: 三島</p>
                  <a href={listUrl}>都道府県から探す</a>
                </>
              )
            )}
          </div>
        </div>
      </dialog>
    </>
  );
}
