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
import {
  lazy,
  Suspense,
  useEffect,
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
import { useMapController } from "../../features/map/use-map-controller";
import { useCardData } from "../../features/card-data/use-card-data";
import { MapSearch } from "./map-search";
import { useMapNavigation } from "./use-map-navigation";
import { useDetailSelection, useKeptPins } from "./use-detail-selection";
import { useDetailSheet } from "./use-detail-sheet";
import { useExplorerLayout } from "./use-explorer-layout";
import { useSelectionMetrics } from "./use-selection-metrics";
import { MapDetailSheet } from "./map-detail-sheet";
import { MapNotices } from "./map-notices";

const FriendMap = /* @__PURE__ */ lazy(
  () => import("../../features/friends/friend-map"),
);

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
  const own = useRecords();
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

export default function MapPage() {
  const dataResult = useCardData();
  const controller = useMapController();
  const friend = useFriend();
  const ready = !!dataResult.data && controller.mapState !== "loading";
  const content = (
    <MapContent dataResult={dataResult} controller={controller} />
  );
  // One's own records wait for one's own map.
  return import.meta.env.VITE_ACCOUNTS_ENABLED === "true" ? (
    <RecordsBoundary
      ready={ready && friend === null}
      aliases={dataResult.data?.cardAliases}
    >
      <FriendLayer
        friend={friend}
        ready={ready}
        aliases={dataResult.data?.cardAliases}
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
}: {
  dataResult: ReturnType<typeof useCardData>;
  controller: ReturnType<typeof useMapController>;
}) {
  const { data, pins: loadedPins, error: dataError, fixture } = dataResult;
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
  const pinSource = useMemo(
    () => data ?? (loadedPins && { pins: loadedPins }),
    [data, loadedPins],
  );
  const countPinsSource = useKeptPins(
    useMemo(() => visiblePins(pinSource, false), [pinSource]),
  );
  const explorerRef = useRef<HTMLElement>(null);
  const detail = useDetailSelection(data, pinSource, adapterRef);
  const sheet = useDetailSheet(explorerRef, detail);
  const {
    selection,
    searching,
    pins,
    selectedPins,
    catalog,
    search,
    openSearch,
    closeSearch,
    updateSearch,
    selectCard,
    issues,
    closeCard,
  } = detail;
  const received =
    import.meta.env.VITE_ACCOUNTS_ENABLED === "true" ? records.records : null;
  const receiptFilter =
    import.meta.env.VITE_ACCOUNTS_ENABLED === "true" ? records.filter : "all";
  const filteredPins = /* @__PURE__ */ useMemo(
    () => receiptPins(pins, received, receiptFilter),
    [pins, received, receiptFilter],
  );
  const filteredSelected = /* @__PURE__ */ useMemo(
    () => receiptPins(selectedPins, received, receiptFilter),
    [selectedPins, received, receiptFilter],
  );
  const filteredCounts = /* @__PURE__ */ useMemo(
    () => receiptPins(countPinsSource, received, receiptFilter),
    [countPinsSource, received, receiptFilter],
  );
  const { dismissFromMap, selectFromMap, show, mapClickStart } = sheet;
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
  );

  return (
    <main
      ref={explorerRef}
      className={`explorer ${selection && !searching ? "has-detail" : ""}`}
    >
      <h1 className="map-search-sr-only">マンホールカード地図</h1>
      <MapSearch
        catalog={catalog}
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
        dataError={dataError}
        onSelect={(card) => {
          selectCard(card.id);
          show([card.id], card.id);
        }}
        pref={prefectures.find((pref) => pref.name === focus.pref)?.code}
      />
      <div
        id="map"
        className="map-stage"
        aria-label="カードの地図"
        onClickCapture={(event) => {
          mapClickStart.current = event.timeStamp;
        }}
      >
        {/* Created at once; the pins are drawn when they arrive. */}
        {!dataError && (
          <MapStage
            pinsLoaded={!!loadedPins}
            focus={focus}
            onFocus={changeFocus}
            countPinsSource={
              import.meta.env.VITE_ACCOUNTS_ENABLED === "true"
                ? filteredCounts
                : countPinsSource
            }
            pins={
              import.meta.env.VITE_ACCOUNTS_ENABLED === "true"
                ? filteredPins
                : pins
            }
            selectedPins={
              searching
                ? EMPTY_PINS
                : import.meta.env.VITE_ACCOUNTS_ENABLED === "true"
                  ? filteredSelected
                  : selectedPins
            }
            onSelect={selectFromMap}
            onDismiss={dismissFromMap}
            onReady={mapReady}
            onError={mapError}
            onWarning={mapWarning}
          />
        )}
        <MapStatus state={dataError ? "data-error" : mapState} />
      </div>
      <MapNotices
        recordsControl={
          import.meta.env.VITE_ACCOUNTS_ENABLED === "true" &&
          records.phase !== "signed-out" ? (
            <RecordFilter showFriend />
          ) : null
        }
        fixture={fixture}
        issues={issues}
        closeCard={closeCard}
        dataError={dataError}
        message={message}
        locationDenied={locationDenied}
        dismissMessage={dismissMessage}
        asOf={data?.evaluatedAt || data?.updated}
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
        aria-busy={locating}
        disabled={mapState !== "ready" || locating}
        onClick={locate}
      >
        <LocateFixed aria-hidden="true" size={20} />
      </button>
      <MapDetailSheet
        data={data}
        mapState={mapState}
        detail={detail}
        sheet={sheet}
      />
    </main>
  );
}
