import { memo, useCallback, useLayoutEffect, useRef, useState } from "react";
import { municipalityName } from "../../domain/card-presentation";
import { ChevronUp, X } from "lucide-react";
import { CardDetail } from "../../features/card-detail/card-detail";
import { pinReasonLabels } from "../../domain/card-catalog";
import { labels } from "../../shared/ui/labels";
import { Delayed } from "../../shared/ui/delayed";
import type { Data } from "../../domain/types";
import type { useDetailSelection } from "./use-detail-selection";
import type { useDetailSheet } from "./use-detail-sheet";
// Moving the sheet re-renders the page; the card's content stays as it was.
const SheetCardDetail = memo(CardDetail);
type Props = {
  data: Data | null;
  detail: Pick<
    ReturnType<typeof useDetailSelection>,
    | "selection"
    | "searching"
    | "selected"
    | "group"
    | "searchDetail"
    | "catalog"
    | "revealedLid"
    | "showLid"
    | "showPlaces"
    | "choosePlace"
    | "choice"
    | "setChoice"
  >;
  sheet: Pick<
    ReturnType<typeof useDetailSheet>,
    | "close"
    | "closeSheet"
    | "sheetDrag"
    | "sheetCollapsed"
    | "detailRef"
    | "sheetState"
    | "opening"
    | "full"
    | "layoutFull"
    | "finishMotion"
    | "moveMap"
    | "mobile"
    | "expandSheet"
    | "summarizeSheet"
    | "chooseFromGroup"
  >;
};
export function MapDetailSheet({ data, detail, sheet }: Props) {
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
    choosePlace,
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
  // The handlers change with the sheet's state; the content calls the latest.
  const latest = useRef({ expandSheet, moveMap, showLid, showPlaces });
  useLayoutEffect(() => {
    latest.current = { expandSheet, moveMap, showLid, showPlaces };
  });
  const expand = useCallback(
    (...args: Parameters<typeof expandSheet>) =>
      latest.current.expandSheet(...args),
    [],
  );
  const toLid = useCallback(
    () => latest.current.moveMap(latest.current.showLid),
    [],
  );
  const toPlaces = useCallback(
    () => latest.current.moveMap(latest.current.showPlaces),
    [],
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
                    "button:not(:disabled), a[href], select:not(:disabled), input:not(:disabled), textarea:not(:disabled)",
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
          {/* The heading again, once it has scrolled out of the full view. */}
          <span className="sheet-bar-title" aria-hidden="true">
            <span className="sheet-bar-name">
              {selected
                ? municipalityName(selected.city)
                : data
                  ? "この場所のカード"
                  : null}
            </span>
            {selected && (
              <span className="sheet-bar-meta">
                {[selected.series, selected.id].filter(Boolean).join(" · ")}
              </span>
            )}
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
          {selected && group.length > 1 && (
            <button
              type="button"
              className="detail-back"
              onClick={() => chooseFromGroup()}
            >
              一覧に戻る（{group.length}枚）
            </button>
          )}
          <button
            className="detail-close"
            type="button"
            aria-label="閉じる"
            onClick={() => closeSheet()}
          >
            <X aria-hidden="true" size={20} />
          </button>
        </div>
        {/* oxlint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events -- 本文タップの補助操作。キーボード用のつまみを併設する。 */}
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
            <SheetCardDetail
              key={`${selected.id}:${selection.started}`}
              actionContainer={mobile ? actionContainer : undefined}
              onExpand={mobile ? expand : undefined}
              summaryReason={
                mobile &&
                searchDetail &&
                !catalog?.entriesById.get(selected.id)?.hasPin
                  ? catalog?.entriesById
                      .get(selected.id)
                      ?.pinReasons.map((reason) => pinReasonLabels[reason])
                      .join("。 ")
                  : undefined
              }
              selectedPinId={selection.pinId}
              showingLid={revealedLid === selected.id}
              card={selected}
              data={data}
              catalog={catalog}
              onShowLid={toLid}
              onShowPlaces={toPlaces}
              onChoosePlace={choosePlace}
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
                {!full && (
                  <button
                    type="button"
                    className="sheet-more"
                    aria-expanded={full}
                    onClick={() => expandSheet()}
                  >
                    詳しく <ChevronUp size={16} aria-hidden="true" />
                  </button>
                )}
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
          ) : data ? (
            <h2 tabIndex={-1}>該当するカードはありません</h2>
          ) : (
            // Chosen before the details arrived; they show here on arrival.
            // As the summary, the waiting sheet keeps to its bar's height
            // instead of the whole budget, and grows when they come.
            <div className="sheet-summary">
              <Delayed>
                <p role="status">カード情報を読み込み中…</p>
              </Delayed>
            </div>
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
