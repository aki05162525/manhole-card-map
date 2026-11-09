import { useState } from "react";
import { municipalityName } from "../../domain/card-presentation";
import { ChevronUp, X } from "lucide-react";
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
  } = detail;
  const {
    close,
    closeSheet,
    sheetDrag,
    sheetCollapsed,
    detailRef,
    sheetState,
    opening,
    full,
    layoutFull,
    finishMotion,
    moveMap,
    mobile,
    expandSheet,
    summarizeSheet,
    chooseFromGroup,
  } = sheet;
  const [actionContainer, setActionContainer] = useState<HTMLDivElement | null>(
    null,
  );
  if (!selection || searching) return null;
  return (
    <>
      {/* oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- 子要素の Escape を同じ section で委譲し、伝播停止と非モーダルな意味を維持する。 */}
      <section
        id="detail"
        className={`detail-panel is-${sheetState}${opening ? " is-opening" : ""}${layoutFull ? " has-full-layout" : " has-summary-layout"}`}
        role={full ? "dialog" : undefined}
        aria-modal={full ? true : undefined}
        aria-owns={full && selected ? "sheet-action-bar" : undefined}
        aria-label="カードの詳細"
        ref={detailRef}
        onTransitionEnd={(event) => {
          if (
            event.target === event.currentTarget &&
            event.propertyName === "transform"
          )
            finishMotion();
        }}
        onKeyDown={(event) => {
          if (full && event.key === "Tab") {
            const controls = [event.currentTarget, actionContainer]
              .flatMap((root) =>
                Array.from(
                  root?.querySelectorAll<HTMLElement>(
                    "button:not(:disabled), a[href], select",
                  ) ?? [],
                ),
              )
              .filter(
                (node) =>
                  !node.closest("[inert], [hidden]") &&
                  node.getClientRects().length > 0,
              );
            const first = controls[0],
              last = controls.at(-1);
            if (
              event.shiftKey &&
              (document.activeElement === first ||
                document.activeElement?.tagName === "H2")
            ) {
              event.preventDefault();
              last?.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
              event.preventDefault();
              first?.focus();
            }
          }
          if (event.key === "Escape") {
            event.stopPropagation();
            if (full) summarizeSheet();
            else close();
          }
        }}
      >
        <div className="detail-actions" {...sheetDrag}>
          <button
            type="button"
            className="sheet-back"
            tabIndex={layoutFull ? 0 : -1}
            aria-hidden={!layoutFull}
            onClick={summarizeSheet}
          >
            ← 地図
          </button>
          <span className="sheet-bar-title">
            {selected
              ? data?.places.find(
                  (place) =>
                    place.id === selection.pinId ||
                    place.id ===
                      data.relations.find(
                        (relation) => relation.cardId === selected.id,
                      )?.placeId,
                )?.name
              : "この場所のカード"}
          </span>
          <button
            className="detail-drag-handle"
            type="button"
            aria-label={
              sheetCollapsed
                ? "詳細を開く"
                : full
                  ? "詳細を要約に戻す"
                  : "詳細を全画面で開く"
            }
            aria-expanded={!sheetCollapsed}
            onClick={(event) => {
              // Pointer taps are already handled by the drag release.
              if (event.detail !== 0) return;
              if (full) summarizeSheet();
              else expandSheet();
            }}
          />
          <div className="detail-heading">
            {selected ? (
              <>
                <h2 className="detail-prelude" tabIndex={-1}>
                  <span className="card-stamp">{selected.id}</span> ·{" "}
                  {selected.pref} {municipalityName(selected.city)} ·{" "}
                  {selected.series}
                </h2>
              </>
            ) : (
              <p className="eyebrow">この場所で探すカード</p>
            )}
            {selected && group.length > 1 && (
              <button type="button" onClick={() => chooseFromGroup()}>
                一覧に戻る（{group.length}枚）
              </button>
            )}
          </div>
          <button
            className="detail-close"
            type="button"
            aria-label="閉じる"
            onClick={() => closeSheet()}
          >
            <X aria-hidden="true" size={20} />
          </button>
        </div>
        {/* oxlint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events -- 本文タップの補助操作。キーボード用の「詳しく」ボタンを併設する。 */}
        <div
          className="detail-body"
          onScroll={(event) => {
            event.currentTarget
              .closest(".detail-panel")
              ?.classList.toggle(
                "has-scrolled",
                event.currentTarget.scrollTop > 40,
              );
          }}
          onClick={(event) => {
            if (
              mobile &&
              sheetState === "summary" &&
              !(event.target as HTMLElement).closest("button, a, select, input")
            )
              expandSheet();
          }}
        >
          {!mobile &&
            searchDetail &&
            selected &&
            !catalog?.entriesById.get(selected.id)?.hasPin && (
              <p className="sheet-extra">
                {catalog?.entriesById
                  .get(selected.id)
                  ?.pinReasons.map((reason) => pinReasonLabels[reason])
                  .join("。 ")}
                。地図は移動していません
              </p>
            )}
          {selected && data ? (
            <CardDetail
              actionContainer={mobile ? actionContainer : undefined}
              showPrelude={false}
              onExpand={mobile ? expandSheet : undefined}
              summaryMode={mobile && !layoutFull}
              selectedPinId={selection.pinId}
              showingLid={revealedLid === selected.id}
              card={selected}
              data={data}
              catalog={catalog}
              onShowLid={() => moveMap(showLid)}
              onShowPlaces={() => moveMap(showPlaces)}
              mapReady={mapState === "ready"}
            />
          ) : group.length ? (
            <>
              <div className="sheet-summary group-summary">
                <h2 tabIndex={-1}>この場所のカード {group.length}枚</h2>
                <ul>
                  {group.slice(0, 3).map((card) => (
                    <li key={card.id}>
                      <button
                        type="button"
                        onClick={() => {
                          chooseFromGroup(card.id);
                        }}
                      >
                        {municipalityName(card.city)} {card.id}（
                        {labels[card.status]}）
                      </button>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  className="sheet-more"
                  aria-expanded={full}
                  onClick={() => expandSheet()}
                >
                  詳しく <ChevronUp size={16} aria-hidden="true" />
                </button>
              </div>
              <div className="sheet-extra">
                <p>カードを選んで詳細を開く。矢印キーで選択できます。</p>
                <select
                  size={Math.min(6, Math.max(2, group.length))}
                  aria-label="この場所のカード一覧"
                  value={choice}
                  onChange={(event) => setChoice(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      chooseFromGroup(choice);
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
                    chooseFromGroup(choice);
                  }}
                >
                  選んだカードの詳細を開く
                </button>
              </div>
            </>
          ) : (
            <h2 tabIndex={-1}>該当するカードはありません</h2>
          )}
          {mobile &&
            searchDetail &&
            selected &&
            !catalog?.entriesById.get(selected.id)?.hasPin && (
              <p className="sheet-extra">
                {catalog?.entriesById
                  .get(selected.id)
                  ?.pinReasons.map((reason) => pinReasonLabels[reason])
                  .join("。 ")}
                。地図は移動していません
              </p>
            )}
        </div>
      </section>
      {mobile && selected && (
        <div
          id="sheet-action-bar"
          className={`sheet-action-bar${sheetCollapsed ? " is-collapsed" : ""}`}
          ref={setActionContainer}
          inert={sheetCollapsed}
        />
      )}
    </>
  );
}
