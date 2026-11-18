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
    // Nothing to cancel: an answer after the screen has gone sets nothing,
    // and an attempt still unanswered is the same shared load as the next.
    void sharedCardData()
      .then(setData)
      .catch(() =>
        setError(
          "カード情報を読み込めませんでした。通信を確認して再読み込みしてください。",
        ),
      );
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
