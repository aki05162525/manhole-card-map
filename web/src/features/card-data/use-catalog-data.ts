import { useEffect, useState } from "react";
import { fixtureBuild, loadCardData } from "./card-data";
import type { Data } from "../../domain/types";

/** Independent of map initialization and map performance measurements. */
export function useCatalogData() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError("");
    void loadCardData("full")
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
    reload: () => setAttempt((value) => value + 1),
  };
}
