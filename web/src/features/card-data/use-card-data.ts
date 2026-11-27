import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  dataRevision,
  fixtureBuild,
  loadedDetails,
  loadedPins,
  loadedPlaces,
  loadedSearch,
  placesFailed,
  placesPending,
  placesPinsRead,
  requestDetail,
  requestPlaces,
  requestSearch,
  searchFailed,
  sharedPins,
  subscribeData,
  type Failure,
} from "./card-data";
import { reloadPage } from "../../shared/browser/reload-page";
import {
  diagnosticsEnabled,
  metrics,
} from "../../shared/browser/explorer-metrics";
import {
  detailShard,
  type MapPins,
  type PinsFile,
} from "../../domain/public-views";

const useDataRevision = () =>
  useSyncExternalStore(subscribeData, dataRevision, dataRevision);

/**
 * Every pin of the map, read with the map engine (`wanted`): the first
 * view draws a prefecture's own file (`usePlaces`) and counts from the HTML.
 */
export function useCardData(wanted: boolean) {
  // Another screen of the document may have loaded them already, or may
  // load them (the catalog reads the whole data).
  useDataRevision();
  const [pins, setPins] = useState<PinsFile | null>(() => loadedPins() ?? null);
  const kept = loadedPins();
  if (kept && kept !== pins) setPins(kept);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!wanted || loadedPins()) return;
    const measuring = diagnosticsEnabled();
    let cancelled = false;
    sharedPins().then(
      (value) => {
        if (cancelled) return;
        setPins(value);
        if (measuring) {
          performance.mark("pins-ready");
          performance.measure("pins-load", "data-requested", "pins-ready");
        }
      },
      (error: unknown) => {
        if (cancelled) return;
        if (measuring) metrics.errors.push(String(error));
        setError(
          "カード情報を読み込めませんでした。通信を確認して再読み込みしてください。",
        );
      },
    );
    return () => {
      cancelled = true;
    };
  }, [wanted]);

  return { pins, error, fixture: fixtureBuild };
}

/**
 * The facilities of the prefectures given by code: `chosen` read first, and
 * `ahead` (the other prefectures of a region chosen) behind it. A failed
 * file is asked again by `retry`.
 */
export function usePlaces(chosen: string | undefined, ahead: string[]) {
  useDataRevision();
  const [attempt, setAttempt] = useState(0);
  const aheadKey = ahead.join();
  useEffect(() => {
    if (chosen) requestPlaces(chosen);
    for (const code of aheadKey ? aheadKey.split(",") : [])
      if (code !== chosen) requestPlaces(code, true);
  }, [chosen, aheadKey, attempt]);
  const codes = [...new Set([...(chosen ? [chosen] : []), ...ahead])];
  return {
    file: chosen ? loadedPlaces(chosen) : undefined,
    failed: chosen ? placesFailed(chosen) : undefined,
    /** Some file asked for has not come. */
    pending: codes.some(placesPending),
    retry: () => setAttempt((value) => value + 1),
  };
}

/**
 * The pins the map's screens work from: every pin once they are read with
 * the map engine; until then those of the prefectures read (`partialPins`).
 * `shards` are the detail files there are, from the HTML; without them, or
 * before any prefecture, none.
 */
export function useMapPins(
  full: PinsFile | null,
  shards: string[] | undefined,
): MapPins | null {
  useDataRevision();
  return full ?? (shards ? placesPinsRead(shards) : null);
}

/**
 * What to say of a file that could not be read, and the way out. A failed
 * request is asked again. A file that is gone belongs to a generation the
 * server has replaced: the page opens again at its URL, which keeps the
 * chosen card, and reads the generation served now.
 */
function recovery(failure: Failure | undefined, retry: () => void) {
  return failure === "gone"
    ? {
        error:
          "カード情報が更新されました。再読み込みして最新の情報を表示してください。",
        action: "再読み込み",
        retry: reloadPage,
      }
    : failure
      ? {
          error: "カード情報を読み込めませんでした。通信を確認してください。",
          action: "再試行",
          retry,
        }
      : { error: "", action: "再試行", retry };
}

/**
 * The details of the cards chosen: their prefectures' files, asked for as
 * the cards are chosen and without waiting for the pins. `data` is null
 * until all of them have arrived, and holds those prefectures' cards only.
 */
export function useDetailData(
  pins: PinsFile | null,
  cardIds: readonly string[],
) {
  useDataRevision();
  const chosen = cardIds.join();
  const wanted = useMemo(
    () => [...new Set(chosen ? chosen.split(",").map(detailShard) : [])].sort(),
    [chosen],
  );
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    // Again for each choice and each retry: a failed file is asked again.
    for (const shard of wanted)
      if (!pins || pins.shards.includes(shard)) requestDetail(shard);
  }, [wanted, pins, attempt]);
  const details = loadedDetails(pins, wanted);
  const failure = typeof details === "string" ? details : undefined;
  return {
    data: typeof details === "string" ? null : details,
    ...recovery(failure, () => setAttempt((value) => value + 1)),
  };
}

/** The national search index, read once the search has been opened. */
export function useSearchIndex(wanted: boolean) {
  useDataRevision();
  useEffect(() => {
    if (wanted) requestSearch();
  }, [wanted]);
  return {
    index: loadedSearch() ?? null,
    ...recovery(searchFailed(), requestSearch),
  };
}

/** Reads a prefecture's details ahead of a choice, when the map goes there. */
export function useDetailWarmup(
  pins: PinsFile | null,
  shard: string | undefined,
) {
  useEffect(() => {
    if (shard && pins?.shards.includes(shard)) requestDetail(shard, true);
  }, [pins, shard]);
}
