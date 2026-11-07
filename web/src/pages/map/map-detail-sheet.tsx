import { X } from "lucide-react";
import { CardDetail } from "../../features/card-detail/card-detail";
import { pinReasonLabels } from "../../domain/card-catalog";
import { labels } from "../../shared/ui/labels";
import type { Data } from "../../domain/types";
import type { useDetailSelection } from "./use-detail-selection";
import type { useDetailSheet } from "./use-detail-sheet";
type Props = {
  data: Data | null;
  mapState: string;
  detail: ReturnType<typeof useDetailSelection>;
  sheet: ReturnType<typeof useDetailSheet>;
};
export function MapDetailSheet({ data, mapState, detail, sheet }: Props) {
  const {
    selection,
    searching,
    selected,
    group,
    searchDetail,
    catalog,
    revealedLid,
    showLid,
    showPlaces,
    choice,
    setChoice,
    selectCard,
  } = detail;
  const {
    close,
    collapseSheet,
    closeSheet,
    sheetDrag,
    sheetCollapsed,
    detailRef,
    setSheetCollapsed,
    show,
  } = sheet;
  if (!selection || searching) return null;
  return (
    // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- 子要素の Escape を同じ section で委譲し、伝播停止と非モーダルな意味を維持する。
    <section
      id="detail"
      className={`detail-panel ${sheetCollapsed ? "is-collapsed" : ""}`}
      aria-label="カードの詳細"
      ref={detailRef}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          close();
        }
      }}
    >
      <div className="detail-actions" {...sheetDrag}>
        <button
          className="detail-drag-handle"
          type="button"
          aria-label={sheetCollapsed ? "詳細を開く" : "詳細をたたむ"}
          aria-expanded={!sheetCollapsed}
          onClick={(event) => {
            // Pointer taps are handled with swipes; detail 0 means the keyboard.
            if (event.detail !== 0) return;
            if (sheetCollapsed) setSheetCollapsed(false);
            else collapseSheet();
          }}
        />
        <div className="detail-heading">
          {selected ? (
            <>
              <h2 tabIndex={-1}>
                {selected.pref}
                {selected.city}
              </h2>
              <span className={`status-badge ${selected.status}`}>
                {labels[selected.status]}
              </span>
            </>
          ) : (
            <p className="eyebrow">この場所で探すカード</p>
          )}
          {selected && group.length > 1 && (
            <button type="button" onClick={() => show(selection.ids)}>
              一覧に戻る（{group.length}枚）
            </button>
          )}
        </div>
        <button
          className="detail-close"
          type="button"
          aria-label="閉じる"
          onClick={closeSheet}
        >
          <X aria-hidden="true" size={20} />
        </button>
      </div>
      <div className="detail-body">
        {searchDetail &&
          selected &&
          !catalog?.entriesById.get(selected.id)?.hasPin && (
            <p>
              {catalog?.entriesById
                .get(selected.id)
                ?.pinReasons.map((reason) => pinReasonLabels[reason])
                .join("。 ")}
              。地図は移動していません
            </p>
          )}
        {selected && data ? (
          <CardDetail
            showingLid={revealedLid === selected.id}
            card={selected}
            data={data}
            catalog={catalog}
            onShowLid={showLid}
            onShowPlaces={showPlaces}
            mapReady={mapState === "ready"}
          />
        ) : group.length ? (
          <>
            <h2 tabIndex={-1}>この位置・範囲のカード {group.length}枚</h2>
            <p>カードを選んで詳細を開く。矢印キーで選択できます。</p>
            <select
              size={Math.min(6, Math.max(2, group.length))}
              aria-label="この位置・範囲のカード一覧"
              value={choice}
              onChange={(event) => setChoice(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  selectCard(choice);
                  show(selection.ids, choice);
                }
              }}
            >
              {group.map((card) => (
                <option key={card.id} value={card.id}>
                  {card.pref} {card.city} {card.id}（{labels[card.status]}）
                </option>
              ))}
            </select>
            <button
              className="primary-button"
              type="button"
              onClick={() => {
                selectCard(choice);
                show(selection.ids, choice);
              }}
            >
              選んだカードの詳細を開く
            </button>
          </>
        ) : (
          <h2 tabIndex={-1}>該当するカードはありません</h2>
        )}
      </div>
    </section>
  );
}
