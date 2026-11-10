import {
  RecordsProvider,
  useRecords,
} from "../../features/records/records-context";
import { RecordFilter } from "../../features/records/record-controls";
import { receiptPins } from "../../domain/records";
import { useMemo, useRef } from "react";
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
import { useDetailSelection } from "./use-detail-selection";
import { useDetailSheet } from "./use-detail-sheet";
import { useExplorerLayout } from "./use-explorer-layout";
import { useSelectionMetrics } from "./use-selection-metrics";
import { MapDetailSheet } from "./map-detail-sheet";
import { MapNotices } from "./map-notices";

const EMPTY_PINS: Pin[] = [];
export default function MapPage() {
  const dataResult = useCardData();
  const controller = useMapController();
  return (
    <RecordsProvider
      ready={!!dataResult.data && controller.mapState !== "loading"}
      aliases={dataResult.data?.cardAliases}
    >
      <MapContent dataResult={dataResult} controller={controller} />
    </RecordsProvider>
  );
}
function MapContent({
  dataResult,
  controller,
}: {
  dataResult: ReturnType<typeof useCardData>;
  controller: ReturnType<typeof useMapController>;
}) {
  const { data, error: dataError, fixture } = dataResult;
  const records = useRecords();
  const {
    adapterRef,
    mapState,
    message,
    mapError,
    mapWarning,
    mapReady,
    locate,
    locating,
  } = controller;
  const { focus, changeFocus } = useMapNavigation();
  const countPinsSource = useMemo(() => visiblePins(data, false), [data]);
  const explorerRef = useRef<HTMLElement>(null);
  const detail = useDetailSelection(data, adapterRef);
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
  const filteredPins = useMemo(
    () => receiptPins(pins, records.records, records.filter),
    [pins, records.records, records.filter],
  );
  const filteredSelected = useMemo(
    () => receiptPins(selectedPins, records.records, records.filter),
    [selectedPins, records.records, records.filter],
  );
  const filteredCounts = useMemo(
    () => receiptPins(countPinsSource, records.records, records.filter),
    [countPinsSource, records.records, records.filter],
  );
  const { dismissFromMap, selectFromMap, show, mapClickStart } = sheet;
  useSelectionMetrics(sheet.detailRef, selection);
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
        {data && (
          <MapStage
            focus={focus}
            onFocus={changeFocus}
            countPinsSource={filteredCounts}
            pins={filteredPins}
            selectedPins={searching ? EMPTY_PINS : filteredSelected}
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
          records.phase !== "signed-out" ? <RecordFilter /> : null
        }
        fixture={fixture}
        issues={issues}
        closeCard={closeCard}
        dataError={dataError}
        message={message}
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
