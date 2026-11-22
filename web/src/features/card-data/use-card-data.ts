import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  dataRevision,
  fixtureBuild,
  loadedDetails,
  loadedPins,
  loadedSearch,
  requestDetail,
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
import { detailShard, type PinsFile } from "../../domain/public-views";

const useDataRevision = () =>
  useSyncExternalStore(subscribeData, dataRevision, dataRevision);

/** The map's first data: its pins, with which it starts. */
export function useCardData() {
  // Another screen of the document may have loaded them already.
  const [pins, setPins] = useState<PinsFile | null>(() => loadedPins() ?? null);
  const [error, setError] = useState("");
  useEffect(() => {
    // The map is created now, with or without its pins.
    const measuring = diagnosticsEnabled();
    if (measuring) performance.mark("map-create");
    if (loadedPins()) return;
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
  }, []);

  return { pins, error, fixture: fixtureBuild };
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
