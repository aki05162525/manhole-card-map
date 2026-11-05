import { leafletCreate } from "./leaflet-common";

// Diagnostic control: intentionally no geographic background or network request.
export const create = leafletCreate(10, async (map) => {
  map.attributionControl.addAttribution("診断用：背景地図なし");
});
