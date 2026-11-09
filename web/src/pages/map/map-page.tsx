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
  const { data, error: dataError, fixture } = useCardData();
  const {
    adapterRef,
    mapState,
    message,
    mapError,
    mapWarning,
    mapReady,
    locate,
    locating,
  } = useMapController();
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
  const { dismissFromMap, selectFromMap, show, mapClickStart } = sheet;
  useSelectionMetrics(sheet.detailRef, selection);
  useExplorerLayout(
    explorerRef,
    sheet.detailRef,
    selection,
    searching,
    sheet.sheetState,
  );

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
            selectedPins={searching ? EMPTY_PINS : selectedPins}
            onSelect={selectFromMap}
            onDismiss={dismissFromMap}
            onReady={mapReady}
            onError={mapError}
            onWarning={mapWarning}
          />
        )}
        <MapStatus state={dataError ? "data-error" : mapState} />
      </div>
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
      <MapNotices
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
