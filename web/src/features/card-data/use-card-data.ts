import { useEffect, useState } from "react";
import { fixtureBuild, loadedCardData, sharedCardData } from "./card-data";
import { metrics } from "../../shared/browser/explorer-metrics";
import type { Data } from "../../domain/types";

const mode = () => metrics.mode as "full" | "split";
export function useCardData() {
  // Another screen of the document may have loaded the data already.
  const [loaded] = useState(() => loadedCardData(mode()));
  const [data, setData] = useState<Data | null>(loaded ?? null);
  const [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    if (loaded) {
      performance.mark("map-create");
      return;
    }
    sharedCardData(mode())
      .then((value) => {
        if (cancelled) return;
        setData(value);
        performance.mark("data-ready");
        performance.measure("data-load", "data-requested", "data-ready");
        performance.mark("map-create");
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        metrics.errors.push(String(error));
        setError(
          "カード情報を読み込めませんでした。通信を確認して再読み込みしてください。",
        );
      });
    return () => {
      cancelled = true;
    };
  }, [loaded]);

  return { data, error, fixture: fixtureBuild };
}
