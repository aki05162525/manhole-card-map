import type { Data } from "../../domain/types";

async function json(url: string, init?: RequestInit) {
  let response = await fetch(url, init);
  // A kept failure (another deployment answered 404) is asked again.
  if (!response.ok) response = await fetch(url, { ...init, cache: "reload" });
  if (!response.ok) throw new Error(`${url}: ${response.status}`);
  return response.json();
}
// A real build names its data generation (`vite.config.ts`) and reads the
// copy under that name, which is kept without revalidation and never holds
// another generation. Fixture and dev data keep the plain, revalidated URL.
const version = (): string | undefined => import.meta.env.VITE_DATA_VERSION;
function dataUrl(name: string) {
  return version() ? `/data-v/${version()}/${name}.json` : `/data/${name}.json`;
}
// This browser has read this generation's details, which it keeps for good
// under their own URL: reading them again takes no bandwidth. Only the
// generation's name is stored; without storage the details wait as on a
// first visit.
const DETAILS_KEY = "card-details-generation";
function detailsKept() {
  try {
    return !!version() && localStorage.getItem(DETAILS_KEY) === version();
  } catch {
    return false;
  }
}
function keepDetails() {
  try {
    if (version()) localStorage.setItem(DETAILS_KEY, version()!);
  } catch {
    // The next visit waits for the map, as this one did.
  }
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
 * the bandwidth with what the map needs first, unless the browser keeps it
 * already (`detailsKept`). The catalog needs everything at once and reads full.json.
 */
function startLoad(split: boolean): Load {
  performance.mark("data-requested");
  if (!split) {
    const data: Promise<Data> = json(dataUrl("full"));
    return { pins: data, data, askDetails() {} };
  }
  const pins: Promise<Pins> = json(dataUrl("pins"));
  let askDetails!: () => void;
  const asked = new Promise<void>((resolve) => (askDetails = resolve));
  const details: Promise<Omit<Data, "pins">> = asked.then(() =>
    json(dataUrl("details")),
  );
  if (detailsKept()) askDetails();
  const data = Promise.all([pins, details]).then(([pins, details]) => {
    if (pins.updated !== details.updated)
      throw new Error("データの版が一致しない");
    keepDetails();
    return { ...details, pins: pins.pins };
  });
  return { pins, data, askDetails };
}

let load: Load | undefined;
// Asked before the load began (the map's first effects run before it).
let detailsWanted = false;
/**
 * One load of this build's data generation, shared by the screens of a
 * document: whichever screen starts it, split or full, the other takes it.
 * A failed load is forgotten, so the next call asks again.
 */
function sharedLoad(split: boolean) {
  if (!load) {
    const entry: Load = startLoad(split);
    entry.pins.then(
      (pins) => (entry.receivedPins = pins),
      () => {},
    );
    entry.data.then(
      (data) => (entry.received = data),
      () => {
        if (load === entry) load = undefined;
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
