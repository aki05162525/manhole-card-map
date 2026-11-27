import type {
  DetailFile,
  PinsFile,
  PlacesFile,
  SearchFile,
} from "./public-views.ts";
import type { Data } from "./types.ts";

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isCardAliases(value: unknown): value is Record<string, string> {
  return (
    record(value) &&
    Object.values(value).every((alias) => typeof alias === "string")
  );
}

// Check file envelopes at the fetch boundary. The generator checks individual
// cards, places and relations before publishing them.
type Files = {
  full: Data;
  pins: PinsFile;
  search: SearchFile;
  detail: DetailFile;
  places: PlacesFile;
};
// The arrays each file must hold.
const lists: Record<keyof Files, string[]> = {
  full: ["pins", "cards", "places", "relations"],
  pins: ["pins", "shards"],
  search: ["cards"],
  detail: ["cards", "places", "relations"],
  places: ["pins", "borders"],
};
export function assertPublicData<K extends keyof Files>(
  file: K,
  value: unknown,
): asserts value is Files[K] {
  if (
    !record(value) ||
    value.schema !== 1 ||
    typeof value.updated !== "string" ||
    !value.updated.trim() ||
    !lists[file].every((name) => Array.isArray(value[name])) ||
    (value.cardAliases !== undefined && !isCardAliases(value.cardAliases))
  )
    throw new Error(`${file}: 公開データの形式が一致しない`);
}
