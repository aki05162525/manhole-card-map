import { diagnosticsEnabled } from "../../shared/browser/explorer-metrics";
import { assertPublicData } from "../../domain/public-data";
import type { Data } from "../../domain/types";

async function json<K extends "full" | "pins" | "details">(
  file: K,
  retry: boolean,
) {
  const url = dataUrl(file);
  let response = await fetch(url, retry ? { cache: "reload" } : undefined);
  // Any failure is asked once more past the HTTP cache: a kept failure, such
  // as a 404 from another deployment, would otherwise stay.
  if (!response.ok && !retry) response = await fetch(url, { cache: "reload" });
  if (!response.ok) throw new Error(`${url}: ${response.status}`);
  const value: unknown = await response.json();
  assertPublicData(file, value);
  return value;
}
// A real build names its data generation (`vite.config.ts`) and reads the
// copy under that name, which is kept without revalidation and never holds
// another generation. Fixture and dev data keep the plain, revalidated URL.
function dataUrl(name: string) {
  const version: string | undefined = import.meta.env.VITE_DATA_VERSION;
  return version ? `/data-v/${version}/${name}.json` : `/data/${name}.json`;
}
// Synthetic builds (`vite build --mode fixture`) warn on every data page.
export const fixtureBuild = import.meta.env.MODE === "fixture";

type Pins = Pick<Data, "updated" | "pins">;
type Load = {
  pins: Promise<Pins>;
  data: Promise<Data>;
  askDetails(): void;
  receivedPins?: Pins;
  received?: Data;
};
/**
 * The map draws from pins.json; details.json, which the search and the
 * details need, waits until `requestDetails()` so that it does not share
 * the bandwidth or the main thread with what the map needs first, even
 * from the cache. The catalog needs everything at once and reads full.json.
 */
function startLoad(split: boolean, retry: boolean): Load {
  if (diagnosticsEnabled()) performance.mark("data-requested");
  if (!split) {
    const data: Promise<Data> = json("full", retry);
    return { pins: data, data, askDetails() {} };
  }
  const pins: Promise<Pins> = json("pins", retry);
  let askDetails!: () => void;
  const asked = new Promise<void>((resolve) => (askDetails = resolve));
  const details: Promise<Omit<Data, "pins">> = asked.then(() =>
    json("details", retry),
  );
  const data = Promise.all([pins, details]).then(([pins, details]) => {
    if (pins.updated !== details.updated)
      throw new Error("データの版が一致しない");
    return { ...details, pins: pins.pins };
  });
  return { pins, data, askDetails };
}

let load: Load | undefined;
// The map retries by reloading the document. A fresh module has forgotten
// the failed generation, but the immutable HTTP response can still be cached.
const navigation = performance.getEntriesByType?.("navigation")[0];
let retry =
  !!navigation && "type" in navigation && navigation.type === "reload";
// Asked before the load began (the map's first effects run before it).
let detailsWanted = false;
/**
 * One load of this build's data generation, shared by the screens of a
 * document: whichever screen starts it, split or full, the other takes it.
 * A failed load is forgotten, so the next call asks again.
 */
function sharedLoad(split: boolean) {
  if (!load) {
    const entry: Load = startLoad(split, retry);
    entry.pins.then(
      (pins) => (entry.receivedPins = pins),
      () => {},
    );
    entry.data.then(
      (data) => (entry.received = data),
      // Still this load: only this failure forgets it, and none starts
      // while it is kept.
      () => {
        load = undefined;
        retry = true;
      },
    );
    load = entry;
    if (detailsWanted) entry.askDetails();
  }
  return load;
}
/** The map's: the pins first, then everything. */
export const sharedMapData = () => sharedLoad(true);
/** The catalog's: everything. */
export function sharedCardData() {
  const load = sharedLoad(false);
  load.askDetails();
  return load.data;
}
/**
 * The map has drawn its pins, or failed, or something needs the details
 * (a card, a pin, the search): read them now.
 */
export function requestDetails() {
  detailsWanted = true;
  load?.askDetails();
}
/** What the shared load has already received, for a first render. */
export const loadedPins = () => load?.receivedPins;
export const loadedCardData = () => load?.received;
