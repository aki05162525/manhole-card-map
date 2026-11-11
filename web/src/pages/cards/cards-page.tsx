import {
  RecordsBoundary,
  RecordFilter,
} from "../../features/records/records-entry";
import { prefecturePage } from "../../domain/prefecture-pages";
import { LoadingLogo } from "../../shared/ui/loading-logo";
import { DataErrorBanner } from "../../shared/ui/data-error-banner";
import { SiteHeader } from "../../shared/ui/site-header";
import {
  SearchSkeleton,
  SEARCH_PLACEHOLDER,
} from "../../shared/ui/search-feedback";
import { useEffect, useMemo, useState } from "react";
import { CardDetail } from "../../features/card-detail/card-detail";
import {
  catalogOverview,
  createCardCatalog,
  OTHER_PREF_LABEL,
} from "../../domain/card-catalog";
import type { CatalogSummary } from "../../domain/catalog-summary";
import { mapCardUrl } from "../../shared/url/catalog-url";
import { useCatalogNavigation } from "./use-catalog-navigation";
import { CatalogResults } from "./catalog-results";
import { SourceNotes } from "../../shared/ui/source-notes";
import { type Data } from "../../domain/types";
import { useCatalogData } from "../../features/card-data/use-catalog-data";
import "../../features/card-detail/detail-content.css";
import "./cards.css";

/**
 * The entry supplies the locally hosted Noto Sans JP font, and the summary
 * that cards.html carries from the build: with it the first view needs no data.
 */
export function CardsPage({
  summary,
}: {
  summary?: CatalogSummary | undefined;
}) {
  const { data, error, fixture, reload } = useCatalogData();
  return (
    <div className="cards-page">
      <SiteHeader current="cards" />
      <main>
        {fixture && (
          <p className="catalog-notice" role="status">
            検証用の架空データです。実在する訪問先の情報として使わないでください。
          </p>
        )}
        {error ? (
          <div className="catalog-data-error">
            <DataErrorBanner message={error} onReload={reload} />
          </div>
        ) : data || summary ? (
          import.meta.env.VITE_ACCOUNTS_ENABLED === "true" ? (
            <RecordsBoundary ready={data !== null} aliases={data?.cardAliases}>
              <CatalogContent data={data} summary={summary} />
            </RecordsBoundary>
          ) : (
            <CatalogContent data={data} summary={summary} />
          )
        ) : (
          <CatalogLoading />
        )}
      </main>
      <footer className="catalog-footer">
        <SourceNotes showLegend={false} variant="catalog" />
        <a href="/about#credits">出典・このサイトについて</a>
      </footer>
    </div>
  );
}

function CatalogLoading() {
  return (
    <div role="status">
      <div className="catalog-loading-heading">
        <LoadingLogo />
        <p>カード情報を読み込み中…</p>
      </div>
      <SearchSkeleton />
    </div>
  );
}

/** Until the data arrives, the summary counts the regions and the results wait. */
function CatalogContent({
  data,
  summary,
}: {
  data: Data | null;
  summary: CatalogSummary | undefined;
}) {
  const catalog = useMemo(() => data && createCardCatalog(data), [data]);
  const overview = useMemo(
    () => catalog ?? catalogOverview(summary!),
    [catalog, summary],
  );
  const evaluatedAt = data ? data.evaluatedAt : summary!.evaluatedAt;
  const {
    state,
    cards,
    page,
    navigate,
    openDetail,
    closeDetail,
    changePage,
    detailHeading,
    resultsHeading,
    recordFiltered,
  } = useCatalogNavigation(catalog);
  const [draft, setDraft] = useState(state.q);
  useEffect(() => setDraft(state.q), [state.q]);
  const selectedPref = [
    ...overview.areas.flatMap((area) => area.prefectures),
    overview.other,
  ].find((pref) => pref.code === state.pref);
  const selected =
    catalog && state.card ? catalog.entriesById.get(state.card) : undefined;
  const withPin = useMemo(
    () =>
      cards.reduce(
        (sum, card) => sum + Number(catalog?.entriesById.get(card.id)?.hasPin),
        0,
      ),
    [cards, catalog],
  );
  // Before the data, only a prefecture's whole count is known.
  const total = catalog
    ? page.total
    : state.q
      ? 0
      : (selectedPref ?? overview).total;
  return (
    <>
      <div
        className={`catalog-intro${state.pref ? " catalog-intro-pref" : ""}`}
      >
        <h1>
          {state.pref ? (
            <>
              {selectedPref?.name}
              {total > 0 && (
                <span className="catalog-pref-count">
                  <span className="catalog-count-lid">{total}</span>
                  <small className="catalog-unit">枚</small>
                </span>
              )}
            </>
          ) : (
            "マンホールカード一覧"
          )}
        </h1>
        {!state.pref && total > 0 && (
          <p>
            {overview.total.toLocaleString("ja-JP")}
            <small className="catalog-unit">枚</small>・
            <span className="catalog-date">
              {evaluatedAt || "基準日の記載なし"}
              {evaluatedAt ? "時点" : ""}
            </span>
          </p>
        )}
        {state.pref && catalog && page.total > 0 && (
          <p>
            ピンあり{withPin}・なし{cards.length - withPin} ·{" "}
            <span className="catalog-date">
              {evaluatedAt || "基準日の記載なし"}
              {evaluatedAt ? "時点" : ""}
            </span>
          </p>
        )}
        {state.pref && selectedPref && (
          <p>
            <a href={`/pref/${prefecturePage(selectedPref.name).slug}/`}>
              {selectedPref.name}の配布場所一覧ページ
            </a>
          </p>
        )}
      </div>
      {!state.pref && (
        <p>
          都道府県・自治体ごとにマンホールカードの配布場所を一覧で確認できます。
        </p>
      )}
      <div
        className={
          state.pref
            ? "catalog-controls catalog-controls-pref"
            : "catalog-controls"
        }
      >
        {state.pref && (
          <div className="catalog-pref-select">
            <label htmlFor="catalog-pref">地域を切り替える</label>
            <select
              id="catalog-pref"
              name="pref"
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
              {overview.areas.map((area) => (
                <optgroup key={area.id} label={area.name}>
                  {area.prefectures.map((pref) => (
                    <option key={pref.code} value={pref.code}>
                      {pref.name}
                    </option>
                  ))}
                </optgroup>
              ))}
              <option value="other">{OTHER_PREF_LABEL}</option>
            </select>
          </div>
        )}
        <form
          className="catalog-search search-controls"
          role="search"
          action="/cards"
          method="get"
          onSubmit={(event) => {
            event.preventDefault();
            navigate({ ...state, q: draft.trim(), page: 1, card: null });
          }}
        >
          <label htmlFor="catalog-search">自治体・施設・番号で検索</label>
          <div className="search-input-line">
            <input
              id="catalog-search"
              type="search"
              autoComplete="off"
              name="q"
              enterKeyHint="search"
              value={draft}
              placeholder={SEARCH_PLACEHOLDER}
              onChange={(event) => setDraft(event.target.value)}
            />
            <button type="submit">検索</button>
          </div>
          {import.meta.env.VITE_ACCOUNTS_ENABLED === "true" && (
            <RecordFilter
              caption
              onChange={() => navigate({ ...state, page: 1 })}
            />
          )}
        </form>
      </div>
      {!state.pref && !state.q && !recordFiltered ? (
        <section
          className="catalog-regions"
          aria-labelledby="catalog-regions-title"
        >
          <h2
            id="catalog-regions-title"
            className="catalog-sr-only"
            ref={resultsHeading}
            tabIndex={-1}
          >
            地域から選ぶ
          </h2>
          {overview.areas.map((area) => (
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
                    <span>
                      {pref.total}
                      <small>枚</small>
                    </span>
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
            <span>
              {overview.other.total}
              <small>枚</small>
            </span>
          </button>
        </section>
      ) : null}

      {catalog && state.issues.length > 0 && (
        <div className="catalog-notice" role="alert">
          {state.issues.map((issue, index) => (
            <p key={index}>{issue.message}</p>
          ))}
          <button onClick={() => navigate({ ...state }, true)}>
            指定を修正して一覧へ戻る
          </button>
        </div>
      )}
      {catalog && selected && (
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
            data={catalog.data}
            catalog={catalog}
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
      {!catalog
        ? (state.card || state.pref || state.q) && <CatalogLoading />
        : (state.pref || state.q || recordFiltered) && (
            <CatalogResults
              catalog={catalog}
              page={page}
              state={state}
              selectedPrefName={selectedPref?.name}
              headingRef={resultsHeading}
              withPin={withPin}
              onOpenDetail={openDetail}
              onChangePage={changePage}
            />
          )}
    </>
  );
}
