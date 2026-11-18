import { useEffect, useState } from "react";
import { fixtureBuild, loadedCardData, sharedCardData } from "./card-data";
import type { Data } from "../../domain/types";

/** Independent of map initialization and map performance measurements. */
export function useCatalogData() {
  // The map in the same document may have loaded the data already.
  const [data, setData] = useState<Data | null>(() => loadedCardData() ?? null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    void sharedCardData()
      .then((value) => {
        if (!cancelled) setData(value);
      })
      .catch(() => {
        if (!cancelled)
          setError(
            "カード情報を読み込めませんでした。通信を確認して再読み込みしてください。",
          );
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);
  return {
    data,
    error,
    fixture: fixtureBuild,
    // The retry itself takes the old failure away, before its own answer.
    reload: () => {
      setError("");
      setAttempt((value) => value + 1);
    },
  };
}
