import { Fragment, memo, type RefObject } from "react";
import {
  OTHER_PREF_LABEL,
  type CardCatalog,
  type CatalogPage,
} from "../../domain/card-catalog";
import { catalogUrl, type CatalogUrlState } from "../../shared/url/catalog-url";
import { municipalityName } from "../../domain/card-presentation";
import { SearchEmptyState, SearchPin } from "../../shared/ui/search-feedback";
import { StatusChip } from "../../shared/ui/status-chip";

/** Draft search input must not rerender the rows or recount the filtered pins. */
export const CatalogResults = memo(function CatalogResults({
  catalog,
  page,
  state,
  selectedPrefName,
  headingRef,
  onOpenDetail,
  onChangePage,
  onClearSearch,
  withPin,
}: {
  catalog: CardCatalog;
  page: CatalogPage;
  state: CatalogUrlState;
  selectedPrefName: string | undefined;
  headingRef: RefObject<HTMLHeadingElement | null>;
  onOpenDetail(id: string): void;
  onChangePage(page: number): void;
  onClearSearch(): void;
  withPin: number;
}) {
  return (
    <section
      aria-labelledby="catalog-results-title"
      className="catalog-results"
    >
      <div
        className={
          state.pref
            ? "catalog-results-heading catalog-sr-only"
            : "catalog-results-heading"
        }
      >
        <h2 id="catalog-results-title" tabIndex={-1} ref={headingRef}>
          {selectedPrefName ?? "全国"} · {page.total}枚
          {state.q && (
            <span className="catalog-query">「{state.q}」の検索結果</span>
          )}
        </h2>
        {!state.pref && (
          <p aria-live="polite">
            ピンあり{withPin}・なし{page.total - withPin} ·{" "}
            {catalog.data.evaluatedAt || "基準日の記載なし"}
            {catalog.data.evaluatedAt ? "時点" : ""}
          </p>
        )}
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
                  <h3>
                    <a
                      className="catalog-row-link"
                      aria-label={`${municipalityName(card.city)} ${card.id}`}
                      id={`catalog-row-${card.id}`}
                      href={catalogUrl({ ...state, card: card.id })}
                      onClick={(event) => {
                        if (
                          event.button !== 0 ||
                          event.metaKey ||
                          event.ctrlKey ||
                          event.shiftKey ||
                          event.altKey
                        )
                          return;
                        event.preventDefault();
                        onOpenDetail(card.id);
                      }}
                    >
                      {municipalityName(card.city)}
                    </a>
                  </h3>
                  <StatusChip status={card.status} />
                </div>
                <p className="catalog-id">
                  {card.id} · {card.series || "弾の記載なし"}
                </p>
                <p className="catalog-facility">
                  {entry.places[0]?.name ?? "配布施設の登録なし"}
                  {entry.facilityCount > 1 && (
                    <>
                      {" "}
                      <span className="catalog-facility-more">
                        ほか{entry.facilityCount - 1}施設
                      </span>
                    </>
                  )}
                </p>
                <div className="catalog-row-bottom">
                  <SearchPin entry={entry} />
                  <span className="catalog-row-arrow" aria-hidden="true">
                    →
                  </span>
                </div>
              </article>
            </Fragment>
          );
        })}
      </div>
      {!page.total && (
        <SearchEmptyState title="該当するカードはありません">
          <p>地域や検索語を変えてお試しください。</p>
          {state.q && <button onClick={onClearSearch}>検索をクリア</button>}
        </SearchEmptyState>
      )}
      {page.total > 0 && (
        <nav className="catalog-pagination" aria-label="一覧のページ送り">
          <button
            disabled={page.page <= 1}
            onClick={() => onChangePage(page.page - 1)}
          >
            前へ
          </button>
          <p>
            {page.start}–{page.end}枚 / {page.total}枚
          </p>
          <button
            disabled={page.page >= page.totalPages}
            onClick={() => onChangePage(page.page + 1)}
          >
            次へ
          </button>
        </nav>
      )}
    </section>
  );
});
