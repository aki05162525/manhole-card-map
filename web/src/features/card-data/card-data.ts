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
  receivedPins?: Pins;
  received?: Data;
};
/**
 * The map draws from pins.json while details.json, which the search and
 * the details need, comes behind it; the catalog needs everything at once
 * and reads full.json.
 */
function startLoad(split: boolean): Load {
  performance.mark("data-requested");
  if (!split) {
    const data: Promise<Data> = json(dataUrl("full"));
    return { pins: data, data };
  }
  const pins: Promise<Pins> = json(dataUrl("pins"));
  // Behind the map's own requests (`index.html` preloads it alike).
  const details: Promise<Omit<Data, "pins">> = json(dataUrl("details"), {
    priority: "low",
  });
  const data = Promise.all([pins, details]).then(([pins, details]) => {
    if (pins.updated !== details.updated)
      throw new Error("データの版が一致しない");
    return { ...details, pins: pins.pins };
  });
  return { pins, data };
}

let load: Load | undefined;
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
  }
  return load;
}
/** The map's: the pins first, then everything. */
export const sharedMapData = () => sharedLoad(true);
/** The catalog's: everything. */
export const sharedCardData = () => sharedLoad(false).data;
/** What the shared load has already received, for a first render. */
export const loadedPins = () => load?.receivedPins;
export const loadedCardData = () => load?.received;
