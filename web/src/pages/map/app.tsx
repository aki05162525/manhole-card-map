import { focusFromHistory } from "../../features/map/map-history";
import { areas, prefectures } from "../../prefectures";
import type { MapFocus } from "../../features/map/map-levels";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LocateFixed, X } from "lucide-react";
import {
  cardsForIds,
  detailCard,
  selectionPins,
  visiblePins,
} from "../../domain/card-selection";
import { labels } from "../../shared/ui/labels";
import { painted } from "../../shared/browser/painted";
import { metrics } from "../../shared/browser/explorer-metrics";
import { CardDetail } from "../../features/card-detail/card-detail";
import { MapStage } from "../../features/map/map-stage";
import { useCardData } from "../../features/card-data/use-card-data";
import { pinReasonLabels, createCardCatalog } from "../../domain/card-catalog";
import { useSheetDrag } from "./use-sheet-drag";
import {
  floatingDetail,
  mapDismissAction,
} from "../../features/map/map-dismiss";
import { mapSearchScreen } from "./map-search-state";
import { MapSearch } from "./map-search";
import { useMapUrlState } from "./use-map-url-state";
import { useMapController } from "../../features/map/use-map-controller";

// Keep in sync with the .detail-panel transition in style.css.
const SHEET_TRANSITION_MS = 260;

export default function App() {
  const { data, error: dataError, fixture } = useCardData();
  const {
    adapterRef,
    mapState,
    message,
    mapError,
    mapWarning,
    mapReady,
    locate,
  } = useMapController();
  const [focus, setFocus] = useState<MapFocus>({ area: null, pref: null });
  const changeFocus = (next: MapFocus) => {
    if (next.area === focus.area && next.pref === focus.pref) return;
    history.pushState(
      { ...history.state, mapCardNavigation: null, mapFocus: next },
      "",
    );
    setFocus(next);
  };
  useEffect(() => {
    const pop = (event: PopStateEvent) =>
      setFocus(focusFromHistory(event.state));
    window.addEventListener("popstate", pop);
    return () => window.removeEventListener("popstate", pop);
  }, []);
  const countPinsSource = useMemo(() => visiblePins(data, false), [data]);
  const [revealedLid, setRevealedLid] = useState<string>();
  const [selection, setSelection] = useState<{
    ids: string[];
    selectedId?: string;
    started: number;
  } | null>(null);
  const [choice, setChoice] = useState("");
  const [sheetCollapsed, setSheetCollapsed] = useState(false);
  const closing = useRef<number | undefined>(undefined);
  const detailRef = useRef<HTMLElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const mapClickStart = useRef<number | null>(null);
  const explorerRef = useRef<HTMLElement>(null);
  const cards = useMemo(
    () => new Map(data?.cards.map((card) => [card.id, card]) || []),
    [data],
  );
  useEffect(() => {
    const root = explorerRef.current;
    if (!root) return;
    const header = root.querySelector(".map-search-bar");
    const notices = root.querySelector(".map-notices");
    const measure = () => {
      const bottom = Math.max(
        header?.getBoundingClientRect().bottom ?? 0,
        notices?.getBoundingClientRect().bottom ?? 0,
      );
      root.style.setProperty(
        "--header-bottom",
        `${bottom - root.getBoundingClientRect().top}px`,
      );
    };
    const observer = new ResizeObserver(measure);
    if (header) observer.observe(header);
    if (notices) observer.observe(notices);
    measure();
    return () => observer.disconnect();
  }, []);
  const catalog = useMemo(
    () => (data ? createCardCatalog(data) : null),
    [data],
  );
  const cardIds = useMemo(
    () => (data ? new Set(cards.keys()) : undefined),
    [data, cards],
  );
  const {
    cardId,
    issues,
    selectCard,
    closeCard,
    search,
    updateSearch,
    openSearch,
    closeSearch,
    dismissCard,
  } = useMapUrlState(cardIds);
  const searching = mapSearchScreen(search, cardId) === "S";
  const searchDetail = search.phase === "detail";
  const group = useMemo(
    () => cardsForIds(cards, selection?.ids || []),
    [cards, selection],
  );
  const selected = detailCard(group, selection?.selectedId);
  const pins = useMemo(
    () => visiblePins(data, false, revealedLid),
    [data, revealedLid],
  );
  const selectedPins = useMemo(
    () =>
      selectionPins(
        pins.filter((pin) =>
          revealedLid ? pin.kind === "lid" : pin.kind === "place",
        ),
        selected ? [selected.id] : selection?.ids || [],
      ),
    [pins, selected, selection, revealedLid],
  );
  const show = useCallback(
    (ids: string[], selectedId?: string, started = performance.now()) => {
      if (!detailRef.current && document.activeElement instanceof HTMLElement)
        returnFocus.current = document.activeElement;
      window.clearTimeout(closing.current);
      detailRef.current?.style.removeProperty("transform");
      setRevealedLid(undefined);
      setSheetCollapsed(false);
      setSelection({ ids, selectedId, started });
      setChoice(ids[0] || "");
    },
    [],
  );
  const selectFromMap = useCallback(
    (ids: string[]) => {
      const started = mapClickStart.current ?? performance.now();
      mapClickStart.current = null;
      if (ids.length === 1) selectCard(ids[0]);
      show(ids, undefined, started);
    },
    [show, selectCard],
  );
  const close = useCallback(() => {
    setRevealedLid(undefined);
    setSelection(null);
    if (searchDetail) dismissCard();
    else if (cardId || issues.length) closeCard();
    returnFocus.current?.focus();
  }, [cardId, issues.length, closeCard, searchDetail, dismissCard]);
  const collapseSheet = useCallback(() => {
    const detail = detailRef.current;
    if (detail?.querySelector(".detail-body")?.contains(document.activeElement))
      detail.querySelector<HTMLElement>(".detail-close")?.focus();
    setSheetCollapsed(true);
  }, []);
  const closeSheet = useCallback(() => {
    const root = explorerRef.current;
    const panel = detailRef.current;
    if (
      !root ||
      !panel ||
      !floatingDetail(root.clientWidth, root.clientHeight) ||
      matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      close();
      return;
    }
    root.style.setProperty("--detail-sheet-height", "0px");
    panel.style.animation = "none";
    panel.style.transition = "";
    panel.style.transform = "translateY(100%)";
    closing.current = window.setTimeout(close, SHEET_TRANSITION_MS);
  }, [close]);
  const sheetDrag = useSheetDrag({
    panel: detailRef,
    collapsed: sheetCollapsed,
    bodyKey: selection,
    onAction: (action) => {
      if (action === "close") closeSheet();
      else if (action === "collapse") collapseSheet();
      else if (action === "expand") setSheetCollapsed(false);
    },
  });
  const dismissFromMap = useCallback(() => {
    const root = explorerRef.current;
    if (
      root &&
      mapDismissAction(root.clientWidth, root.clientHeight) === "collapse"
    ) {
      collapseSheet();
      return;
    }
    close();
  }, [close, collapseSheet]);
  useEffect(() => {
    window.clearTimeout(closing.current);
    detailRef.current?.style.removeProperty("transform");
    setSheetCollapsed(false);
    if (cardId && cards.has(cardId)) {
      setRevealedLid(undefined);
      setSelection((current) =>
        current?.selectedId === cardId
          ? current
          : {
              ids: current?.ids.includes(cardId) ? current.ids : [cardId],
              selectedId: cardId,
              started: performance.now(),
            },
      );
      setChoice(cardId);
    } else {
      setRevealedLid(undefined);
      setSelection(null);
    }
  }, [cardId, cards, show]);
  useEffect(() => {
    if (!selection) return;
    // The sheet may still be sliding in; scrolling to it would shift the whole page.
    detailRef.current
      ?.querySelector<HTMLElement>("h2")
      ?.focus({ preventScroll: true });
    let cancelled = false;
    void painted().then(() => {
      if (cancelled) return;
      metrics.taps.push(performance.now() - selection.started);
      performance.mark("pin-tap", { startTime: selection.started });
      performance.mark("detail-painted");
      performance.measure("pin-to-detail", "pin-tap", "detail-painted");
    });
    return () => {
      cancelled = true;
    };
  }, [selection]);

  useEffect(() => {
    const root = explorerRef.current;
    const detail = detailRef.current;
    if (!root) return;
    const actions = detail?.querySelector<HTMLElement>(".detail-actions");
    const measure = () => {
      if (!detail || !floatingDetail(root.clientWidth, root.clientHeight)) {
        root.style.setProperty("--detail-sheet-height", "0px");
        return;
      }
      const peek = actions?.offsetHeight ?? 0;
      detail.style.setProperty("--sheet-peek-height", `${peek}px`);
      const safeArea = parseFloat(getComputedStyle(detail).paddingBottom) || 0;
      root.style.setProperty(
        "--detail-sheet-height",
        `${sheetCollapsed ? peek + safeArea : detail.offsetHeight}px`,
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (detail) observer.observe(detail);
    if (actions) observer.observe(actions);
    observer.observe(root);
    return () => {
      observer.disconnect();
      root.style.setProperty("--detail-sheet-height", "0px");
    };
  }, [selection, searching, sheetCollapsed]);

  function showLid() {
    if (!selected) return;
    setRevealedLid(selected.id);
    adapterRef.current?.select(
      (data?.pins || []).filter(
        (pin) =>
          pin.kind === "lid" &&
          !pin.reference &&
          pin.cardIds.includes(selected.id),
      ),
    );
  }
  function showPlaces() {
    setRevealedLid(undefined);
    if (selected)
      adapterRef.current?.select(
        selectionPins(visiblePins(data, false), [selected.id]),
      );
  }

  return (
    <main
      ref={explorerRef}
      className={`explorer ${selection && !searching ? "has-detail" : ""}`}
    >
      <div
        id="map"
        className="map-stage"
        aria-label="カードの地図"
        onClickCapture={(event) => {
          mapClickStart.current = event.timeStamp;
        }}
      >
        {data && (
          <MapStage
            focus={focus}
            onFocus={changeFocus}
            countPinsSource={countPinsSource}
            pins={pins}
            selectedPins={searching ? [] : selectedPins}
            onSelect={selectFromMap}
            onDismiss={dismissFromMap}
            onReady={mapReady}
            onError={mapError}
            onWarning={mapWarning}
          />
        )}
      </div>
      <MapSearch
        catalog={catalog}
        session={search}
        onOpen={openSearch}
        onClose={closeSearch}
        onUpdate={updateSearch}
        dataError={dataError}
        onSelect={(card) => {
          selectCard(card.id);
          show([card.id], card.id);
        }}
        pref={prefectures.find((pref) => pref.name === focus.pref)?.code}
      />
      <div className="map-notices">
        {fixture && (
          <p className="fixture-warning" role="status">
            検証用の架空データです。実在する訪問先の情報として使わないでください。
          </p>
        )}
        {issues.length > 0 && (
          <div role="alert">
            {issues.map((issue, index) => (
              <p key={index}>{issue.message}</p>
            ))}
            <button onClick={closeCard}>カード指定を解除</button>
          </div>
        )}
        {(dataError || message || mapState === "failed") && (
          <p className="map-notice" role="status">
            {dataError || message || "背景地図を読み込めませんでした。"}
          </p>
        )}
      </div>
      {focus.area && (
        <nav className="map-actions" aria-label="地図の移動">
          <span className="breadcrumbs">
            <button
              type="button"
              onClick={() => changeFocus({ area: null, pref: null })}
            >
              全国
            </button>
            {(areas.find((a) => a.id === focus.area)?.prefs.length ?? 0) >
              1 && (
              <>
                {" > "}
                <button
                  type="button"
                  onClick={() => changeFocus({ area: focus.area, pref: null })}
                >
                  {areas.find((a) => a.id === focus.area)?.name}
                </button>
              </>
            )}
            {focus.pref && (
              <>
                {" > "}
                <span>{focus.pref}</span>
              </>
            )}
          </span>
        </nav>
      )}
      <button
        id="locate"
        type="button"
        aria-label="現在地"
        disabled={mapState !== "ready"}
        onClick={locate}
      >
        <LocateFixed aria-hidden="true" size={20} />
      </button>
      {selection && !searching && (
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
      )}
    </main>
  );
}
