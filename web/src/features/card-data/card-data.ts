import type { Data } from "../../domain/types";

async function json(url: string) {
  let response = await fetch(url);
  // A kept failure (another deployment answered 404) is asked again.
  if (!response.ok) response = await fetch(url, { cache: "reload" });
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

export async function loadCardData(mode: "full" | "split"): Promise<Data> {
  performance.mark("data-requested");
  if (mode === "full") return json(dataUrl("full"));
  const [pins, details] = await Promise.all([
    json(dataUrl("pins")),
    json(dataUrl("details")),
  ]);
  if (pins.updated !== details.updated)
    throw new Error("データの版が一致しない");
  return { ...details, pins: pins.pins };
}

type Load = { promise: Promise<Data>; data?: Data };
const loads = new Map<"full" | "split", Load>();
/**
 * One load per mode of this build's data generation, shared by the screens
 * of a document. A failed load is forgotten, so the next call asks again.
 */
export function sharedCardData(mode: "full" | "split") {
  let load = loads.get(mode);
  if (!load) {
    const entry: Load = { promise: loadCardData(mode) };
    entry.promise.then(
      (data) => (entry.data = data),
      () => {
        if (loads.get(mode) === entry) loads.delete(mode);
      },
    );
    loads.set(mode, (load = entry));
  }
  return load.promise;
}
/** What `sharedCardData` has already received, for a first render. */
export const loadedCardData = (mode: "full" | "split") => loads.get(mode)?.data;
