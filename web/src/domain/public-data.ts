import type { Data } from "./types";

type Pins = Pick<Data, "schema" | "updated" | "pins">;
type Details = Omit<Data, "pins"> & { pins: null };

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// Check file envelopes at the fetch boundary. The generator checks individual
// cards, places and relations before publishing them.
type Files = { full: Data; pins: Pins; details: Details };
export function assertPublicData<K extends keyof Files>(
  file: K,
  value: unknown,
): asserts value is Files[K] {
  if (
    !record(value) ||
    value.schema !== 1 ||
    typeof value.updated !== "string" ||
    !value.updated.trim() ||
    (file === "details" ? value.pins !== null : !Array.isArray(value.pins))
  )
    throw new Error(`${file}.json: 公開データの形式が一致しない`);

  if (
    file !== "pins" &&
    (!Array.isArray(value.cards) ||
      !Array.isArray(value.places) ||
      !Array.isArray(value.relations) ||
      (value.cardAliases !== undefined &&
        (!record(value.cardAliases) ||
          !Object.values(value.cardAliases).every(
            (alias) => typeof alias === "string",
          ))))
  )
    throw new Error(`${file}.json: カード情報の形式が一致しない`);
}
