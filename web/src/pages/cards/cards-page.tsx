import {
  RecordsBoundary,
  RecordFilter,
} from "../../features/records/records-entry";
import { useRecords } from "../../features/records/records-context";
import { LoadingLogo } from "../../shared/ui/loading-logo";
import { DataErrorBanner } from "../../shared/ui/data-error-banner";
import { SiteHeader, SkipLink } from "../../shared/ui/site-header";
import {
  SearchSkeleton,
  SEARCH_PLACEHOLDER,
} from "../../shared/ui/search-feedback";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  catalogCards,
  catalogOverview,
  createCardCatalog,
  OTHER_PREF_LABEL,
} from "../../domain/card-catalog";
import type { CatalogSummary } from "../../domain/catalog-summary";
import { useCatalogNavigation } from "./use-catalog-navigation";
import { CatalogResults } from "./catalog-results";
import { SourceNotes } from "../../shared/ui/source-notes";
import type { Data } from "../../domain/types";
import { useCatalogData } from "../../features/card-data/use-catalog-data";
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
      <SkipLink targetId="catalog-main" />
      <SiteHeader current="cards" />
      <main id="catalog-main" tabIndex={-1}>
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
    page,
    navigate,
    changePage,
    resultsHeading,
    recordFiltered,
    leavingFor,
  } = useCatalogNavigation(catalog);
  // The draft is of the search the URL holds (`draftOf`): once the URL
  // holds another, as after a back, the draft starts again from it.
  const [draft, setDraft] = useState(state.q);
  const [draftOf, setDraftOf] = useState(state.q);
  if (draftOf !== state.q) {
    setDraftOf(state.q);
    setDraft(state.q);
  }
  const selectedPref = [
    ...overview.areas.flatMap((area) => area.prefectures),
    overview.other,
  ].find((pref) => pref.code === state.pref);
  // Before the data, only a prefecture's whole count is known.
  const total = catalog
    ? page.total
    : state.q
      ? 0
      : (selectedPref ?? overview).total;
  // How many of this page's cards the visitor has stamped, whatever the
  // filter shows of them.
  const records = /* @__PURE__ */ useRecords();
  const received =
    import.meta.env.VITE_ACCOUNTS_ENABLED === "true" ? records.records : null;
  const stamped = useMemo(
    () =>
      catalog && received && state.pref
        ? catalogCards(catalog, { pref: state.pref, q: "" }).filter((card) =>
            received.has(card.id),
          ).length
        : null,
    [catalog, received, state.pref],
  );
  // Past the contents, the notebook is open at a page: its index runs
  // down the edge.
  const opened = Boolean(state.pref || state.q || recordFiltered);
  const area = overview.areas.find((area) =>
    area.prefectures.some((pref) => pref.code === state.pref),
  );
  // Another page of the notebook is read from its head: without this, a
  // prefecture chosen far down the contents opened as far down its own page.
  const open = (pref: string | null) => {
    navigate({ ...state, pref, page: 1, card: null });
    document.documentElement.scrollTop = 0;
  };
  const pendingFocus = useRef<{
    pref: string;
    trigger: HTMLButtonElement;
  } | null>(null);
  const choosePref = (pref: string, trigger: HTMLButtonElement) => {
    if (pref === state.pref && state.page === 1 && catalog) {
      resultsHeading.current?.focus();
      return;
    }
    pendingFocus.current = { pref, trigger };
    open(pref);
  };
  useLayoutEffect(() => {
    const focusRequest = pendingFocus.current;
    if (!focusRequest) return;
    if (state.pref === focusRequest.pref && !catalog) return;
    if (
      state.pref === focusRequest.pref &&
      document.activeElement === focusRequest.trigger
    ) {
      resultsHeading.current?.focus();
    }
    pendingFocus.current = null;
  }, [catalog, resultsHeading, state.pref, state.page]);
  const regionPicker = opened && (
    <div className="catalog-pref-select">
      <label className="catalog-sr-only" htmlFor="catalog-pref">
        地域を切り替える
      </label>
      <select
        id="catalog-pref"
        name="pref"
        value={state.pref ?? ""}
        onChange={(event) => open(event.target.value || null)}
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
  );
  return (
    <div className={opened ? "techo techo-opened" : "techo"}>
      {opened && (
        <nav className="techo-index" aria-label="地域の見出し">
          <button
            type="button"
            aria-current={state.pref ? undefined : "true"}
            onClick={() => open(null)}
          >
            全国
          </button>
          {overview.areas.map((item) => (
            <div key={item.id}>
              {/* A tab opens its region at the first prefecture. */}
              <button
                type="button"
                aria-current={item === area ? "true" : undefined}
                onClick={(event) =>
                  item.prefectures.length === 1
                    ? choosePref(item.prefectures[0].code, event.currentTarget)
                    : open(item.prefectures[0].code)
                }
              >
                {item.name}
              </button>
              {item === area && item.prefectures.length > 1 && (
                <ul>
                  {item.prefectures.map((pref) => (
                    <li key={pref.code}>
                      <button
                        type="button"
                        aria-current={
                          pref.code === state.pref ? "page" : undefined
                        }
                        onClick={(event) =>
                          choosePref(pref.code, event.currentTarget)
                        }
                      >
                        {pref.name}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
          <button
            type="button"
            aria-current={state.pref === "other" ? "true" : undefined}
            onClick={(event) => choosePref("other", event.currentTarget)}
          >
            その他
          </button>
        </nav>
      )}
      <div className="techo-page">
        <div
          className={`catalog-intro${state.pref ? " catalog-intro-pref" : ""}`}
        >
          {/* The page's number, as a notebook prints it: the prefecture's own. */}
          {opened && (
            <p className="techo-folio" aria-hidden="true">
              {state.pref
                ? /^\d+$/.test(state.pref)
                  ? `No. ${state.pref}`
                  : "No. —"
                : "全国"}
            </p>
          )}
          {state.pref ? (
            <div className="catalog-pref-heading">
              <h1>{selectedPref?.name}</h1>
              {regionPicker}
            </div>
          ) : (
            <h1>マンホールカード一覧</h1>
          )}
          {/* The page's whole count, with the stamps among them: what a
              search or a filter leaves is the results' to say. */}
          {(state.pref ? selectedPref : overview)?.total ? (
            <p className="techo-count">
              <b>
                {(state.pref ? selectedPref! : overview).total.toLocaleString(
                  "ja-JP",
                )}
              </b>
              <small className="catalog-unit">枚</small>
              {state.pref && stamped !== null && (
                <span className="techo-stamped">
                  うち入手 <b>{stamped}</b>
                  <small className="catalog-unit">枚</small>
                </span>
              )}
            </p>
          ) : null}
          {(state.pref ? catalog && page.total > 0 : total > 0) && (
            <p className="catalog-date">
              {evaluatedAt || "基準日の記載なし"}
              {evaluatedAt ? " 現在" : ""}
            </p>
          )}
        </div>
        {!opened && (
          <p className="techo-lead">
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
          {!state.pref && regionPicker}
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
            <label className="catalog-sr-only" htmlFor="catalog-search">
              自治体・施設・番号で検索
            </label>
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
              <RecordFilter onChange={() => navigate({ ...state, page: 1 })} />
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
                      type="button"
                      data-pref={pref.code}
                      key={pref.code}
                      onClick={() => open(pref.code)}
                    >
                      {pref.name}
                      <i aria-hidden="true" />
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
              type="button"
              className="catalog-other"
              data-pref="other"
              onClick={() => open("other")}
            >
              {OTHER_PREF_LABEL}
              <i aria-hidden="true" />
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
            <button type="button" onClick={() => navigate({ ...state }, true)}>
              指定を修正して一覧へ戻る
            </button>
          </div>
        )}
        {leavingFor && (
          <p className="catalog-notice" role="status">
            <a href={leavingFor}>カードの案内ページ</a>へ移動します。
          </p>
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
                narrowed={Boolean(state.q) || recordFiltered}
                onChangePage={changePage}
              />
            )}
      </div>
    </div>
  );
}
