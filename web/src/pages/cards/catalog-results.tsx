import { Fragment, memo, useMemo, type RefObject } from "react";
import {
  OTHER_PREF_LABEL,
  type CardCatalog,
  type CatalogPage,
} from "../../domain/card-catalog";
import type { Card } from "../../domain/types";
import type { CatalogUrlState } from "../../shared/url/catalog-url";
import { municipalityName } from "../../domain/card-presentation";
import { StatusChip } from "../../shared/ui/status-chip";

/** Draft search input must not rerender the rows or recount the filtered pins. */
export const CatalogResults = memo(function CatalogResults({
  catalog,
  cards,
  page,
  state,
  selectedPrefName,
  headingRef,
  onOpenDetail,
  onChangePage,
}: {
  catalog: CardCatalog;
  cards: Card[];
  page: CatalogPage;
  state: CatalogUrlState;
  selectedPrefName: string | undefined;
  headingRef: RefObject<HTMLHeadingElement | null>;
  onOpenDetail(id: string): void;
  onChangePage(page: number): void;
}) {
  const withPin = useMemo(
    () =>
      cards.reduce(
        (sum, card) => sum + Number(catalog.entriesById.get(card.id)?.hasPin),
        0,
      ),
    [cards, catalog],
  );
  return (
    <section
      aria-labelledby="catalog-results-title"
      className="catalog-results"
    >
      <div className="catalog-results-heading">
        <h2 id="catalog-results-title" tabIndex={-1} ref={headingRef}>
          {selectedPrefName ?? "全国"} · {page.total}枚
          {state.q && (
            <span className="catalog-query">「{state.q}」の検索結果</span>
          )}
        </h2>
        <p aria-live="polite">
          配布施設ピンあり {withPin}枚 ／ なし {cards.length - withPin}枚
        </p>
        <p className="catalog-meta">
          配布状態の基準日：{catalog.data.evaluatedAt || "記載なし"}
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
                  <h3>{municipalityName(card.city)}</h3>
                  <StatusChip status={card.status} />
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
                    onClick={() => onOpenDetail(card.id)}
                  >
                    詳細を見る
                    <span className="catalog-sr-only">
                      ：{municipalityName(card.city)} {card.id}
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
            onClick={() => onChangePage(page.page - 1)}
          >
            前へ
          </button>
          <button
            disabled={page.page >= page.totalPages}
            onClick={() => onChangePage(page.page + 1)}
          >
            次へ
          </button>
        </div>
      </nav>
    </section>
  );
});
