import type { Data } from "../../domain/types";

async function json(url: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: ${response.status}`);
  return response.json();
}
// Synthetic builds (`vite build --mode fixture`) warn on every data page.
export const fixtureBuild = import.meta.env.MODE === "fixture";

export async function loadCardData(mode: "full" | "split"): Promise<Data> {
  performance.mark("data-requested");
  if (mode === "full") return json("/data/full.json");
  const [pins, details] = await Promise.all([
    json("/data/pins.json"),
    json("/data/details.json"),
  ]);
  if (pins.updated !== details.updated)
    throw new Error("データの版が一致しない");
  return { ...details, pins: pins.pins };
}
