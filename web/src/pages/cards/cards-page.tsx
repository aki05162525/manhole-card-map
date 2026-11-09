import { LoadingLogo } from "../../shared/ui/loading-logo";
import { DataErrorBanner } from "../../shared/ui/data-error-banner";
import { SiteHeader } from "../../shared/ui/site-header";
import { SearchSkeleton } from "../../shared/ui/search-feedback";
import { useEffect, useMemo, useState } from "react";
import { CardDetail } from "../../features/card-detail/card-detail";
import { createCardCatalog, OTHER_PREF_LABEL } from "../../domain/card-catalog";
import { mapCardUrl } from "../../shared/url/catalog-url";
import { useCatalogNavigation } from "./use-catalog-navigation";
import { CatalogResults } from "./catalog-results";
import { SourceNotes } from "../../shared/ui/source-notes";
import { type Data } from "../../domain/types";
import { useCatalogData } from "../../features/card-data/use-catalog-data";
import "../../features/card-detail/detail-content.css";
import "./cards.css";

/** The entry supplies the locally hosted Noto Sans JP font. */
export function CardsPage() {
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
        ) : data ? (
          <CatalogContent data={data} />
        ) : (
          <div role="status">
            <div className="catalog-loading-heading">
              <LoadingLogo />
              <p>カード情報を読み込み中…</p>
            </div>
            <SearchSkeleton />
          </div>
        )}
      </main>
      <footer className="catalog-footer">
        <SourceNotes showLegend={false} variant="catalog" />
        <a href="/about.html#credits">出典・このサイトについて</a>
      </footer>
    </div>
  );
}

function CatalogContent({ data }: { data: Data }) {
  const catalog = useMemo(() => createCardCatalog(data), [data]);
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
  } = useCatalogNavigation(catalog);
  const [draft, setDraft] = useState(state.q);
  useEffect(() => setDraft(state.q), [state.q]);
  const selectedPref = [...catalog.prefectures, catalog.other].find(
    (pref) => pref.code === state.pref,
  );
  const selected = state.card ? catalog.entriesById.get(state.card) : undefined;
  const withPin = useMemo(
    () =>
      cards.reduce(
        (sum, card) => sum + Number(catalog.entriesById.get(card.id)?.hasPin),
        0,
      ),
    [cards, catalog],
  );
  return (
    <>
      <div
        className={`catalog-intro${state.pref ? " catalog-intro-pref" : ""}`}
      >
        <h1>
          {state.pref ? (
            <>
              {selectedPref?.name}
              {page.total > 0 && (
                <span className="catalog-pref-count">
                  <span className="catalog-count-lid">{page.total}</span>
                  <small className="catalog-unit">枚</small>
                </span>
              )}
            </>
          ) : (
            "カード一覧"
          )}
        </h1>
        {!state.pref && page.total > 0 && (
          <p>
            {catalog.total.toLocaleString("ja-JP")}
            <small className="catalog-unit">枚</small>・
            <span className="catalog-date">
              {data.evaluatedAt || "基準日の記載なし"}
              {data.evaluatedAt ? "時点" : ""}
            </span>
          </p>
        )}
        {state.pref && page.total > 0 && (
          <p>
            ピンあり{withPin}・なし{cards.length - withPin} ·{" "}
            <span className="catalog-date">
              {data.evaluatedAt || "基準日の記載なし"}
              {data.evaluatedAt ? "時点" : ""}
            </span>
          </p>
        )}
      </div>
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
              {catalog.areas.map((area) => (
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
          className="catalog-search"
          role="search"
          action="/cards.html"
          method="get"
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
              name="q"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              enterKeyHint="search"
              value={draft}
              placeholder="自治体・施設・カード番号"
              onChange={(event) => setDraft(event.target.value)}
            />
            <button type="submit">検索</button>
          </div>
        </form>
      </div>
      {!state.pref && !state.q ? (
        <section
          className="catalog-regions"
          aria-labelledby="catalog-regions-title"
        >
          <h2 id="catalog-regions-title" className="catalog-sr-only">
            地域から選ぶ
          </h2>
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
              {catalog.other.total}
              <small>枚</small>
            </span>
          </button>
        </section>
      ) : null}

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
    </>
  );
}
