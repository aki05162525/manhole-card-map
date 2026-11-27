import {
  publicViews,
  type PinsFile,
  type PlacesFile,
  type SearchFile,
} from "../../domain/public-views";
import type { Data } from "../../domain/types";

// Tests change their data in place: the views are cut again each time, and
// kept as the same objects while they say the same.
const views = new WeakMap<Data, { text: string; value: unknown }[]>();
function view(data: Data, name: string) {
  const value = publicViews(data)[name];
  const text = JSON.stringify(value);
  const kept = views.get(data) ?? [];
  views.set(data, kept);
  const same = kept.find((item) => item.text === text);
  if (same) return same.value;
  kept.push({ text, value });
  return value;
}
/**
 * `use-card-data` for a test of the screens above it: everything is read
 * already, from one whole `Data` (null while the pins are held back).
 */
export function loadedCardDataHooks(
  current: () => Data | null,
): typeof import("./use-card-data") {
  return {
    useCardData: () => {
      const data = current();
      return {
        pins: data && (view(data, "pins.json") as PinsFile),
        error: "",
        fixture: true,
      };
    },
    useDetailData: (_pins, cardIds) => ({
      data: cardIds.length ? current() : null,
      error: "",
      action: "再試行",
      retry() {},
    }),
    useSearchIndex: () => {
      const data = current();
      return {
        index: data && (view(data, "search.json") as SearchFile),
        error: "",
        action: "再試行",
        retry() {},
      };
    },
    useDetailWarmup() {},
    usePlaces: (chosen) => {
      const data = current();
      return {
        file:
          data && chosen
            ? (view(data, `places-${chosen}.json`) as PlacesFile)
            : undefined,
        failed: undefined,
        pending: false,
        error: "",
        action: "再試行",
        retry() {},
      };
    },
    useMapPins: (full) => full,
  };
}
