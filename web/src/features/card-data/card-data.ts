import type { Data } from "../../domain/types";

async function json(url: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: ${response.status}`);
  return response.json();
}
// A real build names its data generation (`vite.config.ts`), so the URL
// changes with the data and `/data/*` is kept without revalidation.
function dataUrl(name: string) {
  const version: string | undefined = import.meta.env.VITE_DATA_VERSION;
  return `/data/${name}.json${version ? `?v=${version}` : ""}`;
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
