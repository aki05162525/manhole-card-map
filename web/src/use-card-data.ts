import { useEffect, useState } from "react";
import { loadCardData } from "./card-data";
import { metrics } from "./explorer-metrics";
import type { Data } from "./types";

export function useCardData() {
  const [data, setData] = useState<Data | null>(null);
  const [fixture, setFixture] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    void fetch("/FIXTURE_ONLY.txt")
      .then(async (response) => {
        const marker = response.ok ? await response.text() : "";
        if (!cancelled)
          setFixture(
            marker.startsWith("Synthetic cards for CI/browser tests only."),
          );
      })
      .catch(() => {});
    loadCardData(metrics.mode as "full" | "split")
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
  }, []);

  return { data, error, fixture };
}
