import { useEffect, useState } from "react";
import {
  fixtureBuild,
  loadedCardData,
  loadedPins,
  sharedMapData,
} from "./card-data";
import { metrics } from "../../shared/browser/explorer-metrics";
import type { Data, Pin } from "../../domain/types";

/** The map's data: its pins first, then the details for everything else. */
export function useCardData() {
  // Another screen of the document may have loaded the data already.
  const [loaded] = useState(loadedCardData);
  const [pins, setPins] = useState<Pin[] | null>(
    () => (loaded ?? loadedPins())?.pins ?? null,
  );
  const [data, setData] = useState<Data | null>(loaded ?? null);
  const [error, setError] = useState("");
  useEffect(() => {
    // The map is created now, with or without its pins.
    performance.mark("map-create");
    if (loaded) return;
    let cancelled = false;
    const load = sharedMapData();
    load.pins.then(
      (value) => {
        if (cancelled) return;
        setPins(value.pins);
        performance.mark("pins-ready");
        performance.measure("pins-load", "data-requested", "pins-ready");
      },
      () => {},
    );
    load.data
      .then((value) => {
        if (cancelled) return;
        setPins(value.pins);
        setData(value);
        performance.mark("data-ready");
        performance.measure("data-load", "data-requested", "data-ready");
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

  return { pins, data, error, fixture: fixtureBuild };
}
