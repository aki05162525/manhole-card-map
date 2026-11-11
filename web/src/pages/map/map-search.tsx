import { SiteMenu } from "../../shared/ui/site-menu";
import { useRecords } from "../../features/records/records-context";
import {
  RecordBadge,
  RecordFilter,
} from "../../features/records/records-entry";
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
import {
  SearchEmptyState,
  SearchSkeleton,
  SEARCH_PLACEHOLDER,
  SearchPin,
} from "../../shared/ui/search-feedback";
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

export type MapSearchProps = {
  catalog: CardCatalog | null;
  dataError?: string;
  onSelect: (card: Card) => void;
  onReload?: () => void;
  pref?: string | null | undefined;
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
  const records = /* @__PURE__ */ useRecords();
  const matchReceipt =
    import.meta.env.VITE_ACCOUNTS_ENABLED === "true"
      ? records.matches
      : undefined;
  const results = useMemo(() => {
    const result = mapSearchResults(catalog, session.query);
    if (!matchReceipt) return result;
    const cards = result.cards.filter((card) => matchReceipt(card.id));
    return { cards, total: cards.length };
  }, [catalog, session.query, matchReceipt]);
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
          <Logo size={24} />
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
        <SiteMenu current="map" listHref={listUrl} />
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
        <div className="map-search-content search-controls">
          <search className="map-search-input-row search-input-line">
            <button type="button" aria-label="検索を閉じる" onClick={onClose}>
              <ArrowLeft aria-hidden="true" />
            </button>
            <label className="map-search-sr-only" htmlFor={id}>
              自治体・施設・番号で検索
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
                  // Safari can deliver compositionend before this keydown.
                  event.nativeEvent.keyCode !== 229 &&
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
              <SearchSkeleton />
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
                            {import.meta.env.VITE_ACCOUNTS_ENABLED ===
                              "true" && <RecordBadge ids={[card.id]} />}
                          </span>
                          <span className="search-row-meta">
                            <span className="search-card-id">
                              <SearchMatch
                                text={card.id}
                                query={session.query}
                              />
                            </span>
                            <SearchPin entry={entry} />
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
