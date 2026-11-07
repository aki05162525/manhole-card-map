import { Info } from "lucide-react";
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
        cards={cards}
        page={page}
        state={state}
        selectedPrefName={selectedPref?.name}
        headingRef={resultsHeading}
        onOpenDetail={openDetail}
        onChangePage={changePage}
      />
    </>
  );
}
