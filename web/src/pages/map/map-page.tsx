import {
  RecordsBoundary,
  RecordFilter,
} from "../../features/records/records-entry";
import {
  inactive,
  RecordsContext,
  useRecords,
  type Records,
} from "../../features/records/records-context";
import type { FriendRecords } from "../../features/friends/friend-map";
import { receiptPins } from "../../domain/records";
import { countPins, readMapSummary } from "../../domain/map-summary";
import {
  lazy,
  Suspense,
  use,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { routeHistory } from "../../shared/browser/app-history";
import { useScreenActive } from "../../shared/browser/screen-activity";
import { LocateFixed } from "lucide-react";
import { areas, prefectures } from "../../prefectures";
import { visiblePins } from "../../domain/card-selection";
import type { Pin } from "../../domain/types";
import { MapStatus } from "../../features/map/map-status";
import { MapStage } from "../../features/map/map-stage";
import { LevelStage } from "../../features/map/level-stage";
import { PrefStage } from "../../features/map/pref-stage";
import type { StageView } from "../../features/map/stage-camera";
import { useMapController } from "../../features/map/use-map-controller";
import {
  useCardData,
  useDetailWarmup,
  useMapPins,
  usePlaces,
  useSearchIndex,
} from "../../features/card-data/use-card-data";
import { useMapEngine } from "./use-map-engine";
import { MapSearch } from "./map-search";
import { useMapNavigation } from "./use-map-navigation";
import { useDetailSelection, useKeptPins } from "./use-detail-selection";
import { useDetailSheet } from "./use-detail-sheet";
import { useExplorerLayout } from "./use-explorer-layout";
import { useSelectionMetrics } from "./use-selection-metrics";
import { MapDetailSheet } from "./map-detail-sheet";
import { MapNotices } from "./map-notices";
import { mapSurround } from "./map-surround";

const FriendMap = /* @__PURE__ */ lazy(
  () => import("../../features/friends/friend-map"),
);

const NO_RECEIPTS = new Map<string, never>();
const EMPTY_PINS: Pin[] = [];
const entries = routeHistory("map");
const readFriend = () =>
  import.meta.env.VITE_ACCOUNTS_ENABLED === "true"
    ? new URLSearchParams(location.search).get("friend")
    : null;
/** The friend whose map the current entry shows, or null for one's own. */
function useFriend() {
  const [friend, setFriend] = useState(readFriend);
  useEffect(() => {
    const arrive = () => {
      if (entries.owns()) setFriend(readFriend());
    };
    const stop = entries.subscribe(arrive);
    // An arrival between the render and this effect.
    arrive();
    return stop;
  }, []);
  return friend;
}

/**
 * A friend's map is this same map with that friend's records in place of
 * one's own: only the context value changes, so switching between friends
 * or back to one's own keeps the map. The friend's records are fetched while
 * the map is shown, again on each visit, and dropped when it is hidden.
 */
function FriendLayer({
  friend,
  ready,
  aliases,
  children,
}: {
  friend: string | null;
  ready: boolean;
  aliases: Record<string, string> | undefined;
  children: ReactNode;
}) {
  // As the provider handed it on: each part below checks the owner of the
  // value it is handed as it draws (`useRecords`), the friend's included.
  const own = use(RecordsContext);
  const active = useScreenActive();
  const [shown, setShown] = useState<FriendRecords | null>(null);
  // Until the friend's answer; nothing of another friend's.
  const [loadingFriend] = useState<Records>(() => ({
    ...inactive,
    phase: "loading",
    friendName: "",
    filter: "received",
  }));
  const value =
    friend === null
      ? own
      : shown?.friendId === friend
        ? shown.value
        : loadingFriend;
  return (
    <>
      {friend !== null && active && (
        <Suspense fallback={null}>
          <FriendMap
            key={friend}
            friendId={friend}
            ready={ready}
            aliases={aliases}
            onChange={setShown}
          />
        </Suspense>
      )}
      <RecordsContext value={value}>{children}</RecordsContext>
    </>
  );
}

/** The counts the build wrote on the page (`vite.config.ts`). */
const pageSummary = () =>
  readMapSummary(document.getElementById("root")?.dataset ?? {});

export default function MapPage() {
  // Every pin is read with the map engine, once the first view can be used.
  const [engine, setEngine] = useState(false);
  const dataResult = useCardData(engine);
  const controller = useMapController();
  const friend = useFriend();
  const ready = !!dataResult.pins && controller.mapState !== "loading";
  const content = (
    <MapContent
      dataResult={dataResult}
      controller={controller}
      onEngine={setEngine}
    />
  );
  // One's own records wait for one's own map.
  return import.meta.env.VITE_ACCOUNTS_ENABLED === "true" ? (
    <RecordsBoundary
      ready={ready && friend === null}
      aliases={dataResult.pins?.cardAliases}
    >
      <FriendLayer
        friend={friend}
        ready={ready}
        aliases={dataResult.pins?.cardAliases}
      >
        {content}
      </FriendLayer>
    </RecordsBoundary>
  ) : (
    content
  );
}
function MapContent({
  dataResult,
  controller,
  onEngine,
}: {
  dataResult: ReturnType<typeof useCardData>;
  controller: ReturnType<typeof useMapController>;
  onEngine(started: true): void;
}) {
  const { pins: loadedPins, error: dataError, fixture } = dataResult;
  const [summary] = useState(pageSummary);
  const records = /* @__PURE__ */ useRecords();
  const {
    adapterRef,
    mapState,
    message,
    locationDenied,
    dismissMessage,
    mapError,
    mapWarning,
    mapReady,
    locate,
    locating,
  } = controller;
  const { focus, changeFocus } = useMapNavigation();
  // A prefecture chosen is read on its own, its region's neighbours behind
  // it; every pin comes with the map engine.
  const focusedPref = prefectures.find((pref) => pref.name === focus.pref);
  const regionPrefs = focus.pref
    ? []
    : (areas
        .find((area) => area.id === focus.area)
        ?.prefs.flatMap(
          (name) => prefectures.find((pref) => pref.name === name)?.code ?? [],
        ) ?? []);
  // Only while the map engine is not drawing: the map draws its own.
  const drawing = mapState !== "ready";
  const places = usePlaces(
    drawing ? focusedPref?.code : undefined,
    drawing ? regionPrefs : [],
  );
  const source = useMapPins(loadedPins, summary?.shards);
  const countPinsSource = useKeptPins(
    useMemo(() => visiblePins(source, false), [source]),
  );
  const explorerRef = useRef<HTMLElement>(null);
  const mapFrame = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const frame = mapFrame.current;
    if (mapState === "ready" && frame && document.activeElement === frame)
      frame
        .querySelector<HTMLElement>(".maplibregl-canvas")
        ?.focus({ preventScroll: true });
  }, [mapState]);
  const detail = useDetailSelection(source, adapterRef);
  const sheet = useDetailSheet(explorerRef, detail);
  const {
    data,
    selection,
    searching,
    pins,
    selectedPins,
    search,
    openSearch,
    closeSearch,
    updateSearch,
    selectCard,
    issues,
    closeCard,
  } = detail;
  const friendView =
    import.meta.env.VITE_ACCOUNTS_ENABLED === "true" &&
    records.friendName !== undefined;
  const received =
    import.meta.env.VITE_ACCOUNTS_ENABLED === "true" ? records.records : null;
  const receiptFilter =
    import.meta.env.VITE_ACCOUNTS_ENABLED === "true" ? records.filter : "all";
  const visibleReceipts = friendView ? (received ?? NO_RECEIPTS) : received;
  const filteredPins = /* @__PURE__ */ useMemo(
    () => receiptPins(pins, visibleReceipts, receiptFilter),
    [pins, visibleReceipts, receiptFilter],
  );
  const filteredSelected = /* @__PURE__ */ useMemo(
    () => receiptPins(selectedPins, visibleReceipts, receiptFilter),
    [selectedPins, visibleReceipts, receiptFilter],
  );
  const filteredCounts = /* @__PURE__ */ useMemo(
    () => receiptPins(countPinsSource, visibleReceipts, receiptFilter),
    [countPinsSource, visibleReceipts, receiptFilter],
  );
  const counted =
    import.meta.env.VITE_ACCOUNTS_ENABLED === "true"
      ? filteredCounts
      : countPinsSource;
  // The counts are known once the pins are, and the records too when they
  // say which pins to count: a friend's map counts the friend's cards, never
  // the public ones while the friend's records are still on their way.
  const countsKnown =
    !!loadedPins &&
    (import.meta.env.VITE_ACCOUNTS_ENABLED !== "true" ||
      receiptFilter === "all" ||
      received !== null);
  const { dismissFromMap, selectFromMap, show, noteMapClick } = sheet;
  // The public counts are in the HTML; those the records filter are counted
  // from every pin once the records have come.
  const publicCounts =
    import.meta.env.VITE_ACCOUNTS_ENABLED !== "true" ||
    (!friendView && receiptFilter === "all");
  const levelCounts = useMemo(
    () =>
      publicCounts && summary
        ? summary.counts
        : countsKnown
          ? countPins(counted)
          : null,
    [publicCounts, summary, countsKnown, counted],
  );
  // The prefecture's facilities, drawn before the map engine: as the map
  // would draw them, those the records leave.
  const recordsKnown =
    import.meta.env.VITE_ACCOUNTS_ENABLED !== "true" ||
    receiptFilter === "all" ||
    received !== null;
  const shownPins =
    import.meta.env.VITE_ACCOUNTS_ENABLED === "true" ? filteredPins : pins;
  const stagePins = useMemo(
    () =>
      places.file && recordsKnown
        ? shownPins.filter(
            (pin) => pin.kind === "place" && pin.pref === places.file?.pref,
          )
        : EMPTY_PINS,
    [places.file, recordsKnown, shownPins],
  );
  const [drawnView, setDrawnView] = useState<{
    pref: string;
    view: StageView;
    closer: boolean;
  } | null>(null);
  const stageView =
    drawnView && drawnView.pref === focus.pref ? drawnView : null;
  const shownSelected = searching
    ? EMPTY_PINS
    : import.meta.env.VITE_ACCOUNTS_ENABLED === "true"
      ? filteredSelected
      : selectedPins;
  // The drawing shows the facility chosen on it; any other card (from the
  // search or a URL, a lid, a place elsewhere) waits for the map.
  // By id: the records' filter gives each pin it keeps anew.
  const drawnSelection = useMemo(() => {
    const drawn = new Set(stagePins.map((pin) => pin.id));
    return (
      shownSelected.length > 0 &&
      shownSelected.every((pin) => drawn.has(pin.id))
    );
  }, [stagePins, shownSelected]);
  const [asked, setAsked] = useState(false);
  const mapStarted = useMapEngine({
    usable: !focus.pref || !!places.file || !!places.failed,
    busy: places.pending,
    wanted:
      asked ||
      !!places.failed ||
      (!!selection && !searching && !drawnSelection),
    activity: `${focus.area} ${focus.pref} ${selection?.started} ${stageView?.view.zoom}`,
  });
  useEffect(() => {
    if (mapStarted) onEngine(true);
  }, [mapStarted, onEngine]);
  // Looking at the map reads the pins alone. The search reads the national
  // index once it is opened, and stays read for the way back to it.
  const searchIndex = useSearchIndex(!friendView && search.phase !== "map");
  // On a prefecture, its cards' details are read ahead of the first tap.
  useDetailWarmup(source, focusedPref?.code);
  // The detail's heading and its timing wait for the details.
  useSelectionMetrics(sheet.detailRef, data ? selection : null);
  useExplorerLayout(
    explorerRef,
    sheet.detailRef,
    selection,
    searching,
    sheet.sheetState,
    sheet.layoutFull,
    sheet.mobile,
    data,
    friendView,
  );

  return (
    <main
      ref={explorerRef}
      className={`explorer ${selection && !searching ? "has-detail" : ""}`}
    >
      {friendView ? (
        <RecordFilter showFriend />
      ) : (
        <>
          <h1 className="map-search-sr-only">マンホールカード地図</h1>
          <MapSearch
            index={searchIndex.index}
            session={search}
            onOpen={openSearch}
            onClose={closeSearch}
            onClosed={() => {
              // The detail is inert until the modal's exit has finished.
              if (search.phase === "detail") {
                sheet.detailRef.current
                  ?.querySelector<HTMLElement>("h2")
                  ?.focus({ preventScroll: true });
              }
            }}
            onUpdate={updateSearch}
            dataError={searchIndex.error}
            onRetry={searchIndex.retry}
            retryLabel={searchIndex.action}
            onSelect={(card) => {
              selectCard(card.id);
              show([card.id], card.id);
            }}
            pref={focusedPref?.code}
          />
        </>
      )}
      <div
        id="map"
        ref={mapFrame}
        className="map-stage"
        aria-label="カードの地図"
        // Takes the keyboard from the choices when no map comes after them.
        tabIndex={-1}
        onClickCapture={(event) => noteMapClick(event.timeStamp)}
      >
        {/* Read once the first view can be used; the pins are drawn when
            they arrive. */}
        {!dataError && (
          <MapStage
            start={mapStarted}
            pinsLoaded={!!loadedPins}
            focus={focus}
            onFocus={changeFocus}
            countPinsSource={counted}
            pins={shownPins}
            selectedPins={shownSelected}
            // The map opens where the drawing is, the facility chosen on it
            // left where it is.
            stageView={
              drawing && stageView && (!shownSelected.length || drawnSelection)
                ? stageView.view
                : null
            }
            onSelect={selectFromMap}
            onDismiss={dismissFromMap}
            onReady={mapReady}
            onError={mapError}
            onWarning={mapWarning}
            surround={mapSurround}
          />
        )}
        {/* Until the map can be handled, the levels above its pins are
            chosen here, and a prefecture's facilities drawn and pressed;
            the map opens over the level chosen. A map that failed leaves
            them. */}
        {drawing &&
          (focusedPref && places.file ? (
            <PrefStage
              key={focusedPref.code}
              pref={focusedPref}
              file={places.file}
              pins={stagePins}
              cameraPins={counted}
              selected={drawnSelection ? shownSelected : EMPTY_PINS}
              view={stageView?.view ?? null}
              onView={(view, closer) =>
                setDrawnView({ pref: focusedPref.name, view, closer })
              }
              onChoose={(pin) => selectFromMap(pin.cardIds, pin.id)}
              onDismiss={dismissFromMap}
              onWantMap={() => setAsked(true)}
              surround={mapSurround}
            />
          ) : (
            <LevelStage
              counts={levelCounts}
              focus={focus}
              onFocus={changeFocus}
              onWantMap={() => setAsked(true)}
              status={
                places.failed ? (
                  <>
                    {focus.pref}の施設を読み込めませんでした。
                    <button type="button" onClick={places.retry}>
                      再試行
                    </button>
                  </>
                ) : (
                  `${focus.pref}の施設を読み込んでいます`
                )
              }
              surround={mapSurround}
            />
          ))}
        <MapStatus
          friendView={friendView}
          state={dataError ? "data-error" : mapState}
          overDrawing={drawing}
        />
      </div>
      {/* One row beside the search bar on a wide screen; on a phone each
          part is placed on its own (map-status.css, map-overlays.css). */}
      <div className="map-top">
        <MapNotices
          recordsControl={
            import.meta.env.VITE_ACCOUNTS_ENABLED === "true" &&
            !friendView &&
            records.phase !== "signed-out" ? (
              <RecordFilter />
            ) : null
          }
          friendView={friendView}
          fixture={fixture}
          issues={issues}
          closeCard={closeCard}
          dataError={dataError}
          message={message}
          locationDenied={locationDenied}
          dismissMessage={dismissMessage}
          asOf={loadedPins?.evaluatedAt || loadedPins?.updated}
        />
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
                    onClick={() =>
                      changeFocus({ area: focus.area, pref: null })
                    }
                  >
                    {areas.find((a) => a.id === focus.area)?.name}
                  </button>
                </>
              )}
              {focus.pref && (
                <>
                  {" > "}
                  {drawing && stageView?.closer ? (
                    // The drawing came closer: back to the whole prefecture.
                    <button type="button" onClick={() => setDrawnView(null)}>
                      {focus.pref}
                    </button>
                  ) : (
                    <span>{focus.pref}</span>
                  )}
                </>
              )}
            </span>
          </nav>
        )}
      </div>
      <button
        id="locate"
        type="button"
        aria-label="現在地"
        aria-busy={locating}
        disabled={mapState !== "ready" || locating}
        onClick={locate}
      >
        <LocateFixed aria-hidden="true" size={20} />
      </button>
      {(!friendView || selection?.ids.every((id) => received?.has(id))) && (
        <MapDetailSheet data={data} detail={detail} sheet={sheet} />
      )}
    </main>
  );
}
