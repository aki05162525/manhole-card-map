import mapshaper from "mapshaper";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Conservative island protection: any island bounding box within 0.02 degrees
// of a card pin survives, even when the pin is offshore or rounded.
export function commandsFor(sitesFile) {
  return [
    "-dissolve",
    "N03_001",
    "-explode",
    "-require",
    sitesFile,
    "alias=sites",
    "-filter",
    "$.area >= 1000000 || sites.some(p => p[0] >= $.bounds[0]-0.02 && p[0] <= $.bounds[2]+0.02 && p[1] >= $.bounds[1]-0.02 && p[1] <= $.bounds[3]+0.02)",
    "-simplify",
    "dp",
    "interval=800m",
    "keep-shapes",
    "stats",
    "-o",
    "format=geojson",
    "precision=0.000001",
    "background.geojson",
  ];
}
export async function simplify(input, sites = []) {
  const temp = await mkdtemp(join(tmpdir(), "background-test-"));
  try {
    const sitesFile = join(temp, "sites.mjs");
    await writeFile(sitesFile, "export default " + JSON.stringify(sites));
    const files = await mapshaper.applyCommands(
      ["-i", "input.geojson", ...commandsFor(sitesFile)],
      { "input.geojson": JSON.stringify(input) },
    );
    return JSON.parse(files["background.geojson"]);
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
}
