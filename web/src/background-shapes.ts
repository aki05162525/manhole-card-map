import type { Feature, FeatureCollection, MultiPolygon } from "geojson";

// Fewer Canvas paths, identical coordinates: no dissolve, simplification or
// removal of holes/islands happens in the browser.
export function groupBackgroundShapes(
  data: FeatureCollection,
): FeatureCollection<MultiPolygon> {
  const groups = new Map<string, Feature<MultiPolygon>>();
  for (const feature of data.features) {
    const geometry = feature.geometry;
    if (
      !geometry ||
      (geometry.type !== "Polygon" && geometry.type !== "MultiPolygon")
    )
      throw new Error("簡略背景の形式が不正");
    const name = String(feature.properties?.N03_001 ?? "");
    let group = groups.get(name);
    if (!group) {
      group = {
        type: "Feature",
        properties: { N03_001: name },
        geometry: { type: "MultiPolygon", coordinates: [] },
      };
      groups.set(name, group);
    }
    if (geometry.type === "Polygon")
      group.geometry.coordinates.push(geometry.coordinates);
    else group.geometry.coordinates.push(...geometry.coordinates);
  }
  return { type: "FeatureCollection", features: [...groups.values()] };
}
