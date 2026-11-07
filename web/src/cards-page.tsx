import { Info } from "lucide-react";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { CardDetail } from "./card-detail";
import {
  CATALOG_PAGE_SIZE,
  catalogCards,
  createCardCatalog,
  OTHER_PREF_LABEL,
  paginateCards,
} from "./card-catalog";
import {
  catalogUrl,
  mapCardUrl,
  mergeCatalogHistoryState,
  readCatalogUrl,
  type CatalogUrlState,
} from "./catalog-url";
import { SourceNotes } from "./source-notes";
import { labels, type Data } from "./types";
import { useCatalogData } from "./use-catalog-data";
import "./detail-content.css";
import "./cards.css";

/** PR4 mounts this component; the entry supplies the locally hosted Noto Sans JP font. */
export function CardsPage() {
  const { data, error, fixture, reload } = useCatalogData();
  return (
    <div className="cards-page">
      <header className="catalog-header">
        <a className="catalog-brand" href="/">
          ◎ マンホール手帳
        </a>
        <nav aria-label="メインナビゲーション">
          <a href="/">地図</a>
          <a
            className="site-info-link"
            href="/about.html"
            aria-label="このサイトについて"
            title="このサイトについて"
          >
            <Info aria-hidden="true" size={20} />
          </a>
        </nav>
      </header>
      <main>
        <div className="catalog-intro">
          <h1>カード一覧</h1>
          <p>配布施設の情報を、地域から探す。</p>
        </div>
        {fixture && (
          <p className="catalog-notice" role="status">
            検証用の架空データです。実在する訪問先の情報として使わないでください。
          </p>
        )}
        {error ? (
          <div className="catalog-surface" role="alert">
            <p>{error}</p>
            <button onClick={reload}>再読み込み</button>
          </div>
        ) : data ? (
          <CatalogContent data={data} />
        ) : (
          <p role="status">カード情報を読み込み中…</p>
        )}
      </main>
      <footer className="catalog-footer">
        <SourceNotes showLegend={false} />
        <p>「配布中」は在庫を保証するものではありません。</p>
        <a href="/about.html#credits">出典・このサイトについて</a>
      </footer>
    </div>
  );
}

function CatalogContent({ data }: { data: Data }) {
  const catalog = useMemo(() => createCardCatalog(data), [data]);
  const [href, setHref] = useState(() =>
    typeof window === "undefined" ? "/cards.html" : window.location.href,
  );
  const raw = readCatalogUrl(href);
  const cards = useMemo(
    () => catalogCards(catalog, { pref: raw.pref, q: raw.q }),
    [catalog, raw.pref, raw.q],
  );
  const state = readCatalogUrl(href, {
    cardIds: new Set(catalog.cardsById.keys()),
    totalPages: Math.max(1, Math.ceil(cards.length / CATALOG_PAGE_SIZE)),
  });
  const page = paginateCards(cards, state.page);
  const [draft, setDraft] = useState(state.q);
  const detailHeading = useRef<HTMLHeadingElement>(null);
  const resultsHeading = useRef<HTMLHeadingElement>(null);
  const returnRow = useRef<string | null>(null);
  const restoreFocus = useRef(false);
  const ownedEntries = useRef(new Set<string>());
  const sequence = useRef(0);
  useEffect(() => {
    const pop = () => setHref(window.location.href);
    window.addEventListener("popstate", pop);
    return () => window.removeEventListener("popstate", pop);
  }, []);
  useEffect(() => setDraft(state.q), [state.q]);
  useEffect(() => {
    if (state.card) detailHeading.current?.focus();
    else if (restoreFocus.current) {
      restoreFocus.current = false;
      const row = returnRow.current
        ? document.getElementById(`catalog-row-${returnRow.current}`)
        : null;
      (row ?? resultsHeading.current)?.focus();
    }
  }, [state.card]);
  function navigate(next: CatalogUrlState, replace = false, detail = false) {
    const url = catalogUrl(next);
    const historyState = mergeCatalogHistoryState(window.history.state, {
      card: next.card,
    });
    // Only entries created by this mounted catalog may close with history.back().
    const token = detail ? `${Date.now()}-${++sequence.current}` : null;
    if (token) ownedEntries.current.add(token);
    const merged = { ...historyState, catalogDetailEntry: token };
    if (replace) window.history.replaceState(merged, "", url);
    else window.history.pushState(merged, "", url);
    setHref(window.location.href);
  }
  function closeDetail() {
    restoreFocus.current = true;
    if (ownedEntries.current.has(window.history.state?.catalogDetailEntry))
      window.history.back();
    else navigate({ ...state, card: null }, true);
  }
  const selectedPref = [...catalog.prefectures, catalog.other].find(
    (pref) => pref.code === state.pref,
  );
  const selected = state.card ? catalog.entriesById.get(state.card) : undefined;
  const withPin = cards.reduce(
    (sum, card) => sum + Number(catalog.entriesById.get(card.id)?.hasPin),
    0,
  );
  return (
    <>
      <form
        className="catalog-search"
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          navigate({ ...state, q: draft.trim(), page: 1, card: null });
        }}
      >
        <label htmlFor="catalog-search">自治体・施設・カード番号で検索</label>
        <div>
          <input
            id="catalog-search"
            type="search"
            value={draft}
            placeholder="自治体・施設・カード番号"
            onChange={(event) => setDraft(event.target.value)}
          />
          <button type="submit">検索</button>
        </div>
      </form>
      {!state.pref ? (
        <section
          className="catalog-regions catalog-surface"
          aria-labelledby="catalog-regions-title"
        >
          <h2 id="catalog-regions-title">地域から選ぶ</h2>
          {catalog.areas.map((area) => (
            <div className="catalog-region" key={area.id}>
              <h3>{area.name}</h3>
              <div>
                {area.prefectures.map((pref) => (
                  <button
                    data-pref={pref.code}
                    key={pref.code}
                    onClick={() =>
                      navigate({
                        ...state,
                        pref: pref.code,
                        page: 1,
                        card: null,
                      })
                    }
                  >
                    {pref.name}
                    <span>{pref.total}枚</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
          <button
            className="catalog-other"
            data-pref="other"
            onClick={() =>
              navigate({ ...state, pref: "other", page: 1, card: null })
            }
          >
            {OTHER_PREF_LABEL}
            <span>{catalog.other.total}枚</span>
          </button>
        </section>
      ) : (
        <div className="catalog-pref-select">
          <label htmlFor="catalog-pref">地域を切り替える</label>
          <select
            id="catalog-pref"
            value={state.pref}
            onChange={(event) =>
              navigate({
                ...state,
                pref: event.target.value || null,
                page: 1,
                card: null,
              })
            }
          >
            <option value="">全国</option>
            {catalog.areas.map((area) => (
              <optgroup key={area.id} label={area.name}>
                {area.prefectures.map((pref) => (
                  <option key={pref.code} value={pref.code}>
                    {pref.name}（{pref.total}枚）
                  </option>
                ))}
              </optgroup>
            ))}
            <option value="other">
              {OTHER_PREF_LABEL}（{catalog.other.total}枚）
            </option>
          </select>
        </div>
      )}
      {state.issues.length > 0 && (
        <div className="catalog-notice" role="alert">
          {state.issues.map((issue, index) => (
            <p key={index}>{issue.message}</p>
          ))}
          <button onClick={() => navigate({ ...state }, true)}>
            指定を修正して一覧へ戻る
          </button>
        </div>
      )}
      {selected && (
        <section
          className="catalog-detail catalog-surface"
          aria-labelledby="catalog-detail-title"
        >
          <div className="catalog-detail-heading">
            <div>
              <p className="catalog-eyebrow">カードの詳細</p>
              <h2 id="catalog-detail-title" ref={detailHeading} tabIndex={-1}>
                {selected.card.city}
              </h2>
            </div>
            <button onClick={closeDetail}>詳細を閉じる</button>
          </div>
          {!cards.some((card) => card.id === selected.card.id) && (
            <p className="catalog-notice">現在の絞り込み対象外のカードです。</p>
          )}
          <CardDetail
            card={selected.card}
            data={data}
            variant="catalog"
            actions={
              selected.hasPin ? (
                <a
                  className="catalog-map-link"
                  href={mapCardUrl(selected.card.id)}
                >
                  配布場所を地図で見る
                </a>
              ) : null
            }
          />
        </section>
      )}
      <section
        aria-labelledby="catalog-results-title"
        className="catalog-results"
      >
        <div className="catalog-results-heading">
          <h2 id="catalog-results-title" tabIndex={-1} ref={resultsHeading}>
            {selectedPref?.name ?? "全国"} · {page.total}枚
            {state.q && (
              <span className="catalog-query">「{state.q}」の検索結果</span>
            )}
          </h2>
          <p aria-live="polite">
            配布施設ピンあり {withPin}枚 ／ なし {cards.length - withPin}枚
          </p>
          <p className="catalog-meta">
            配布状態の基準日：{data.evaluatedAt || "記載なし"}
          </p>
        </div>
        <div className="catalog-rows">
          {page.cards.map((card, index) => {
            const entry = catalog.entriesById.get(card.id)!;
            const previous = page.cards[index - 1];
            return (
              <Fragment key={card.id}>
                {!state.pref && (!previous || previous.pref !== card.pref) && (
                  <h3 className="catalog-pref-heading">
                    {card.pref || OTHER_PREF_LABEL}
                  </h3>
                )}
                <article className="catalog-row">
                  <div className="catalog-row-title">
                    <h3>{card.city}</h3>
                    <span
                      className={`catalog-status catalog-status-${card.status}`}
                    >
                      {labels[card.status]}
                    </span>
                  </div>
                  <p className="catalog-meta">
                    {card.pref || OTHER_PREF_LABEL} ·{" "}
                    {card.series || "シリーズの記載なし"}
                  </p>
                  <p className="catalog-id">{card.id}</p>
                  <p className="catalog-facility">{entry.facilitySummary}</p>
                  <div className="catalog-row-bottom">
                    <span className="catalog-meta">
                      配布施設ピン{entry.hasPin ? "あり" : "なし"}
                    </span>
                    <button
                      id={`catalog-row-${card.id}`}
                      onClick={() => {
                        returnRow.current = card.id;
                        navigate({ ...state, card: card.id }, false, true);
                      }}
                    >
                      詳細を見る
                      <span className="catalog-sr-only">
                        ：{card.city} {card.id}
                      </span>
                      <span aria-hidden="true"> →</span>
                    </button>
                  </div>
                </article>
              </Fragment>
            );
          })}
        </div>
        {!page.total && (
          <p className="catalog-surface">
            該当するカードはありません。地域や検索語を変えてお試しください。
          </p>
        )}
        <nav className="catalog-pagination" aria-label="一覧のページ送り">
          <p>
            {page.start}–{page.end}枚 / {page.total}枚
            <span className="catalog-meta">
              （{page.page} / {page.totalPages}ページ）
            </span>
          </p>
          <div>
            <button
              disabled={page.page <= 1}
              onClick={() => {
                navigate({ ...state, page: page.page - 1, card: null });
                resultsHeading.current?.focus();
              }}
            >
              前へ
            </button>
            <button
              disabled={page.page >= page.totalPages}
              onClick={() => {
                navigate({ ...state, page: page.page + 1, card: null });
                resultsHeading.current?.focus();
              }}
            >
              次へ
            </button>
          </div>
        </nav>
      </section>
    </>
  );
}
