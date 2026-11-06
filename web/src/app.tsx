import { areas } from "./prefectures";
import type { MapFocus } from "./map-levels";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cardsForIds, detailCard } from "./ui";
import {
  focusFromHistory,
  matchingCards,
  selectionPins,
  visiblePins,
} from "./explorer-state";
import { labels, painted } from "./types";
import { metrics } from "./explorer-metrics";
import { CardDetail } from "./card-detail";
import { SearchPanel } from "./search-panel";
import { MapStage } from "./map-stage";
import { useCardData } from "./use-card-data";
import { useOfflineState } from "./use-offline-state";
import { useMapController } from "./use-map-controller";

export default function App() {
  const { data, error: dataError } = useCardData();
  const offline = useOfflineState();
  const {
    adapterRef,
    initialView,
    mapState,
    message,
    mapError,
    mapWarning,
    mapReady,
    locate,
    japan,
  } = useMapController();
  const [focus, setFocus] = useState<MapFocus>({ area: null, pref: null });
  const changeFocus = (next: MapFocus) => {
    if (next.area === focus.area && next.pref === focus.pref) return;
    history.pushState({ mapFocus: next }, "");
    setFocus(next);
  };
  useEffect(() => {
    const pop = (event: PopStateEvent) =>
      setFocus(focusFromHistory(event.state));
    window.addEventListener("popstate", pop);
    return () => window.removeEventListener("popstate", pop);
  }, []);
  const countPinsSource = useMemo(() => visiblePins(data, false), [data]);
  const [query, setQuery] = useState("");
  const [showLids, setShowLids] = useState(false);
  const [revealedLid, setRevealedLid] = useState<string>();
  const [selection, setSelection] = useState<{
    ids: string[];
    selectedId?: string;
    started: number;
  } | null>(null);
  const [choice, setChoice] = useState("");
  const detailRef = useRef<HTMLElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const mapClickStart = useRef<number | null>(null);
  const cards = useMemo(
    () => new Map(data?.cards.map((card) => [card.id, card]) || []),
    [data],
  );
  const group = useMemo(
    () => cardsForIds(cards, selection?.ids || []),
    [cards, selection],
  );
  const selected = detailCard(group, selection?.selectedId);
  const pins = useMemo(
    () => visiblePins(data, showLids, revealedLid),
    [data, showLids, revealedLid],
  );
  const placeCount = useMemo(() => visiblePins(data, false).length, [data]);
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
  const filtered = useMemo(
    () => matchingCards(data?.cards || [], query, data || undefined),
    [data, query],
  );

  const show = useCallback(
    (ids: string[], selectedId?: string, started = performance.now()) => {
      if (!detailRef.current && document.activeElement instanceof HTMLElement)
        returnFocus.current = document.activeElement;
      setRevealedLid(undefined);
      setSelection({ ids, selectedId, started });
      setChoice(ids[0] || "");
    },
    [],
  );
  const selectFromMap = useCallback(
    (ids: string[]) => {
      const started = mapClickStart.current ?? performance.now();
      mapClickStart.current = null;
      show(ids, undefined, started);
    },
    [show],
  );
  const close = useCallback(() => {
    setRevealedLid(undefined);
    setSelection(null);
    returnFocus.current?.focus();
  }, []);
  useEffect(() => {
    if (!selection) return;
    detailRef.current?.querySelector<HTMLElement>("h2")?.focus();
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

  const notice =
    dataError ||
    message ||
    (mapState === "failed"
      ? "背景地図を読み込めませんでした。一覧・検索からカードを閲覧できます。"
      : !data
        ? "カード情報を読み込み中…"
        : mapState === "loading"
          ? "地図を準備しています。一覧からカードを探せます。"
          : `${data.cards.length.toLocaleString("ja-JP")}枚のカード。訪問前に配布状況をご確認ください。`);
  const fixture = data && "fixture" in data && Boolean(data.fixture);
  return (
    <main className={`explorer ${selection ? "has-detail" : ""}`}>
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
            selectedPins={selectedPins}
            onSelect={selectFromMap}
            onReady={mapReady}
            onError={mapError}
            onWarning={mapWarning}
            initialView={initialView}
          />
        )}
      </div>
      <SearchPanel
        data={data}
        focus={focus}
        onFocus={changeFocus}
        loaded={Boolean(data)}
        fixture={Boolean(fixture)}
        query={query}
        filtered={filtered}
        showLids={showLids}
        revealedLid={revealedLid}
        placeCount={placeCount}
        notice={notice}
        dataError={Boolean(dataError)}
        offline={offline}
        onQuery={setQuery}
        onSelect={(id) => {
          if (focus.pref && cards.get(id)?.pref !== focus.pref)
            changeFocus({ area: null, pref: null, preserveCamera: true });
          show([id]);
        }}
        onShowLids={(value) => {
          setShowLids(value);
          setRevealedLid(undefined);
        }}
      />
      <nav className="map-actions" aria-label="地図の移動">
        {focus.area && (
          <span className="breadcrumbs">
            <button
              type="button"
              onClick={() => changeFocus({ area: null, pref: null })}
            >
              全国
            </button>
            {" > "}
            <button
              type="button"
              onClick={() => changeFocus({ area: focus.area, pref: null })}
            >
              {areas.find((a) => a.id === focus.area)?.name}
            </button>
            {focus.pref && (
              <>
                {" > "}
                <span>{focus.pref}</span>
              </>
            )}
          </span>
        )}
        <button
          id="locate"
          type="button"
          disabled={mapState !== "ready"}
          onClick={locate}
        >
          <span aria-hidden="true">⌖</span> 現在地
        </button>
        <button
          id="japan"
          type="button"
          disabled={mapState !== "ready"}
          onClick={() => {
            if (focus.area || focus.pref)
              changeFocus({ area: null, pref: null });
            else japan();
          }}
        >
          日本全体
        </button>
      </nav>
      {selection && (
        <section
          id="detail"
          className="detail-panel"
          aria-label="カードの詳細"
          ref={detailRef}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.stopPropagation();
              close();
            }
          }}
        >
          <div className="sheet-handle" aria-hidden="true" />
          <div className="detail-actions">
            <button type="button" onClick={close}>
              閉じる
            </button>
            {selected && group.length > 1 && (
              <button type="button" onClick={() => show(selection.ids)}>
                一覧に戻る（{group.length}枚）
              </button>
            )}
          </div>
          {selected && data ? (
            <CardDetail
              card={selected}
              data={data}
              onShowLid={showLid}
              onShowPlaces={showPlaces}
              mapReady={mapState === "ready"}
            />
          ) : group.length ? (
            <>
              <p className="eyebrow">この場所で探すカード</p>
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
                onClick={() => show(selection.ids, choice)}
              >
                選んだカードの詳細を開く
              </button>
            </>
          ) : (
            <h2 tabIndex={-1}>該当するカードはありません</h2>
          )}
        </section>
      )}
    </main>
  );
}
