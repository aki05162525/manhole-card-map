import L from "leaflet";
import { leafletCreate } from "./leaflet-common";

export const create = leafletCreate(18, (map) => {
  let resolve!: () => void, reject!: (e: Error) => void;
  const ready = new Promise<void>((r, j) => {
    resolve = r;
    reject = j;
  });
  const tile = L.tileLayer(
    "https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png",
    {
      maxZoom: 18,
      attribution:
        '<a href="https://maps.gsi.go.jp/development/ichiran.html">地理院タイル</a>',
      keepBuffer: 1,
    },
  );
  let failed = false;
  tile.on("tileerror", () => {
    failed = true;
    reject(new Error("地理院タイルの読み込みに失敗"));
  });
  tile.once("load", () => {
    if (!failed) resolve();
  });

  tile.addTo(map);
  return ready;
});
