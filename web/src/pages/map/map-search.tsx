import { ArrowLeft, Search, X } from "lucide-react";
import {
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { type CardCatalog } from "../../domain/card-catalog";
import { catalogUrl } from "../../shared/url/catalog-url";
import { municipalityName } from "../../domain/card-presentation";
import {
  matchingCards,
  searchResultExcerpt,
} from "../../domain/card-selection";
import { searchSession, type MapSearchSession } from "./map-search-state";
import { StatusChip } from "../../shared/ui/status-chip";
import { Logo } from "../../shared/ui/logo";
import { type Card } from "../../domain/types";
import "./map-search.css";

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

const emptyArt = (
  <svg
    className="search-empty-art"
    width="80"
    height="80"
    viewBox="0 0 32 32"
    fill="none"
    stroke="currentColor"
    aria-hidden="true"
  >
    <circle
      className="search-drawn-line"
      pathLength="100"
      cx="16"
      cy="16"
      r="14"
      strokeWidth="1"
    />
    <circle
      cx="16"
      cy="16"
      r="11.6"
      strokeWidth=".8"
      strokeDasharray="1.2 4.874"
    />
    <circle
      className="search-drawn-line"
      pathLength="100"
      cx="16"
      cy="16"
      r="8.6"
      strokeWidth=".6"
    />
    <rect
      className="search-drawn-line"
      pathLength="100"
      x="12.5"
      y="12.5"
      width="7"
      height="7"
      rx="1"
      strokeWidth=".8"
    />
  </svg>
);

export type MapSearchProps = {
  catalog: CardCatalog | null;
  dataError?: string;
  onSelect: (card: Card) => void;
  onReload?: () => void;
  pref?: string | null;
  session?: MapSearchSession;
  onOpen?: () => void;
  onClose?: () => void;
  onClosed?: () => void;
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
  onClosed,
  onUpdate = () => {},
}: MapSearchProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const entry = useRef<HTMLButtonElement>(null);
  const composing = useRef(false);
  const pressedOutside = useRef(false);
  const [desktop, setDesktop] = useState(
    () =>
      typeof window !== "undefined" &&
      (window.matchMedia?.("(min-width: 1001px)").matches ??
        window.innerWidth >= 1001),
  );
  useEffect(() => {
    const media = window.matchMedia?.("(min-width: 1001px)");
    if (!media) return;
    const update = () => setDesktop(media.matches);
    update();
    media.addEventListener?.("change", update);
    return () => media.removeEventListener?.("change", update);
  }, []);
  const [announcement, setAnnouncement] = useState("");
  const id = useId();
  const open = session.phase === "search";
  const afterClose = useEffectEvent(() => onClosed?.());
  const results = useMemo(
    () => mapSearchResults(catalog, session.query),
    [catalog, session.query],
  );
  useLayoutEffect(() => {
    const element = dialog.current;
    if (!element) return;
    let cancelled = false;
    element.removeAttribute("data-closing");
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
      // Retain the top layer during exit even where discrete display/overlay
      // transitions are unavailable. Reopening cancels the pending close.
      element.setAttribute("data-closing", "");
      const finish = () => {
        if (cancelled || !element.hasAttribute("data-closing")) return;
        element.close();
        element.removeAttribute("data-closing");
        entry.current?.focus({ preventScroll: true });
        afterClose();
      };
      const animations = element.getAnimations?.() ?? [];
      if (animations.length) {
        void Promise.allSettled(
          animations.map((animation) => animation.finished),
        ).then(finish);
      } else finish();
    }
    return () => {
      cancelled = true;
      element.removeAttribute("data-closing");
    };
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
  const empty = Boolean(
    catalog && !dataError && session.query.trim() && !results.total,
  );
  const emptyTitle = `『${session.query.trim()}』に一致するカードはありません`;
  const message = dataError
    ? "カード情報を読み込めませんでした。"
    : !catalog
      ? "読み込み中"
      : session.query.trim()
        ? results.total > session.limit
          ? `${session.limit}件を表示中 · 全${results.total}件`
          : empty
            ? ""
            : `${results.total}件`
        : "";
  useEffect(() => {
    if (!composing.current) setAnnouncement(message);
  }, [message]);
  const changeQuery = (query: string) => {
    onUpdate({ query, limit: 50, scroll: 0, selected: null });
    if (scroller.current) scroller.current.scrollTop = 0;
  };
  const outside = (event: React.PointerEvent<HTMLDialogElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return (
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom
    );
  };
  const listUrl = catalogUrl({ pref, q: "", page: 1, card: null });
  return (
    <>
      <header className="map-search-bar">
        <a className="logo-link" href="/about" aria-label="このサイトについて">
          <Logo />
        </a>
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
        <a href={listUrl}>一覧</a>
      </header>
      <dialog
        ref={dialog}
        className={`map-search-dialog ${desktop ? "map-search-panel" : "map-search-fullscreen"}`}
        {...{ closedby: "any" }}
        onPointerDown={(event) => {
          if (!("closedBy" in HTMLDialogElement.prototype))
            pressedOutside.current = outside(event);
        }}
        onPointerUp={(event) => {
          if (
            !("closedBy" in HTMLDialogElement.prototype) &&
            pressedOutside.current &&
            outside(event)
          )
            onClose?.();
          pressedOutside.current = false;
        }}
        aria-label="カード検索"
        onCancel={(event) => {
          event.preventDefault();
          onClose?.();
        }}
      >
        <div className="map-search-content">
          <search className="map-search-input-row">
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
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              enterKeyHint="search"
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
          </search>
          <div ref={scroller} className="map-search-results">
            {!empty && (
              <h2 ref={heading} tabIndex={-1}>
                {session.query.trim() ? "検索結果" : "探し方"}
              </h2>
            )}
            <div role="status" aria-live="polite" aria-atomic="true">
              {empty ? (
                <div className="map-search-empty">
                  {emptyArt}
                  <h2
                    ref={heading}
                    tabIndex={-1}
                    className="search-empty-title"
                  >
                    {emptyTitle}
                  </h2>
                </div>
              ) : (
                <p>{composing.current ? announcement : message}</p>
              )}
            </div>
            {dataError ? (
              <div className="map-search-error">
                <p>{dataError}</p>
                <button type="button" onClick={onReload}>
                  再読み込み
                </button>
              </div>
            ) : !catalog && session.query.trim() ? (
              <div className="map-search-skeleton" aria-hidden="true">
                <span />
                <span />
                <span />
              </div>
            ) : catalog && session.query.trim() ? (
              <>
                <ul>
                  {results.cards.slice(0, session.limit).map((card) => {
                    const entry = catalog.entriesById.get(card.id)!;
                    const city = municipalityName(card.city);
                    const excerpt = searchResultExcerpt(
                      [city, card.pref, card.id, entry.facilitySummary],
                      entry.places.flatMap((place) => [
                        place.name,
                        place.address,
                      ]),
                      session.query,
                    );
                    return (
                      <li key={card.id}>
                        <button
                          type="button"
                          data-card={card.id}
                          className={
                            city.toLocaleLowerCase() ===
                            session.query.trim().toLocaleLowerCase()
                              ? "search-row-exact"
                              : undefined
                          }
                          onClick={() => {
                            onUpdate({
                              selected: card.id,
                              restore: true,
                              scroll: scroller.current?.scrollTop ?? 0,
                            });
                            onSelect(card);
                          }}
                        >
                          <span className="search-row-heading">
                            <span className="search-municipality">
                              <strong>
                                <SearchMatch
                                  text={city}
                                  query={session.query}
                                />
                              </strong>
                              <span className="search-pref">
                                <SearchMatch
                                  text={card.pref || "県の登録なし"}
                                  query={session.query}
                                />
                              </span>
                            </span>
                            <StatusChip status={card.status} />
                          </span>
                          <span className="search-row-meta">
                            <span className="search-card-id">
                              <SearchMatch
                                text={card.id}
                                query={session.query}
                              />
                            </span>
                            <span className="search-pin">
                              <svg
                                width="8"
                                height="8"
                                viewBox="0 0 10 10"
                                aria-hidden="true"
                              >
                                <rect
                                  x="1"
                                  y="1"
                                  width="8"
                                  height="8"
                                  rx="1"
                                  fill={entry.hasPin ? "currentColor" : "none"}
                                  stroke="currentColor"
                                  strokeWidth="1.5"
                                />
                              </svg>
                              <span aria-hidden="true">
                                {entry.hasPin
                                  ? "あり"
                                  : `なし · ${entry.pinReasons.includes("relation-review") ? "再確認待ち" : entry.pinReasons.includes("no-facility") ? "施設未登録" : "位置未確定"}`}
                              </span>
                              <span className="map-search-sr-only">
                                配布施設ピン{entry.hasPin ? "あり" : "なし"}
                              </span>
                              {!entry.hasPin && (
                                <span className="map-search-sr-only">
                                  {" "}
                                  ·{" "}
                                  {entry.pinReasons.includes("relation-review")
                                    ? "再確認待ち"
                                    : entry.pinReasons.includes("no-facility")
                                      ? "施設未登録"
                                      : "位置未確定"}
                                </span>
                              )}
                            </span>
                            <span className="search-facility">
                              <SearchMatch
                                text={excerpt ?? entry.facilitySummary}
                                query={session.query}
                              />
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
                {!results.total && (
                  <div className="map-search-empty-help">
                    <p>
                      漢字の自治体名・施設名・県名・カード番号の一部で探せます
                    </p>
                    <a href={listUrl}>地域から探す</a>
                  </div>
                )}
                {results.total > session.limit && (
                  <button
                    type="button"
                    className="search-more"
                    onClick={() => onUpdate({ limit: session.limit + 50 })}
                  >
                    さらに{Math.min(50, results.total - session.limit)}件表示
                  </button>
                )}
              </>
            ) : (
              !session.query.trim() && (
                <>
                  <p>
                    漢字の自治体名・施設名・県名・カード番号の一部で探せます
                  </p>
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
