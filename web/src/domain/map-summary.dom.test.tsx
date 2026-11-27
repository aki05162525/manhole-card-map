import { expect, it } from "vitest";
import { visiblePins } from "./card-selection";
import {
  countPins,
  mapSummaryAttributes,
  readMapSummary,
  summarizeMap,
} from "./map-summary";
import { pinsView } from "./public-views";
import type { Data } from "./types";

const card = (id: string, pref: string): Data["cards"][number] => ({
  id,
  pref,
  city: "",
  series: "",
  issued: "",
  acquired: "",
  status: "active",
  lid: { status: "unconfirmed" },
  placeText: null,
  hours: null,
  links: null,
});
const place = (id: string, confirmed = true): Data["places"][number] => ({
  id,
  name: id,
  address: "",
  phone: "",
  coordinate: confirmed
    ? { status: "confirmed", lat: 35, lng: 139 }
    : { status: "candidate" },
});
const pin = (
  id: string,
  pref: string,
  cardIds: string[],
  kind: "place" | "lid" = "place",
): Data["pins"][number] => ({
  id,
  pref,
  cardIds,
  kind,
  status: "active",
  lat: 35,
  lng: 139,
});
const data: Data = {
  schema: 1,
  updated: "2026-11-20",
  cards: [
    card("13-101-A001", "東京都"),
    card("13-102-A001", "東京都"),
    card("14-100-A001", "神奈川県"),
    card("27-100-A001", "大阪府"),
  ],
  places: ["tokyo-1", "tokyo-2", "yokohama", "osaka"].map((id) => place(id)),
  relations: [],
  pins: [
    // One card at two Tokyo facilities is one Tokyo card.
    pin("tokyo-1", "東京都", ["13-101-A001", "14-100-A001"]),
    pin("tokyo-2", "東京都", ["13-101-A001"]),
    // A Tokyo card handed out in Kanagawa counts in Kanagawa as well.
    pin("yokohama", "神奈川県", ["13-102-A001", "14-100-A001"]),
    pin("osaka", "大阪府", ["27-100-A001"]),
    // Lids are not counted.
    pin("lid:27-100-A001", "大阪府", ["27-100-A001"], "lid"),
  ],
};

it("embeds in the HTML the counts the map counted from its pins", () => {
  const page = new DOMParser().parseFromString(
    `<div id="root" ${mapSummaryAttributes(summarizeMap(data))}></div>`,
    "text/html",
  );
  const summary = readMapSummary(page.getElementById("root")!.dataset);
  // As the map counts the pins it is given (`map-page.tsx`).
  expect(summary?.counts).toEqual(
    countPins(visiblePins(pinsView(data), false)),
  );
  expect(summary?.counts.prefs).toMatchObject({
    東京都: 2,
    神奈川県: 2,
    大阪府: 1,
    北海道: 0,
  });
  // The Kanagawa card at a Tokyo and a Kanagawa facility counts once.
  expect(summary?.counts.areas).toMatchObject({ kanto: 3, kinki: 1 });
  expect(summary?.shards).toEqual(["13", "14", "27"]);
});

it("has no summary on a page built without one", () => {
  expect(readMapSummary({})).toBeUndefined();
  expect(
    readMapSummary({ prefCounts: "13:1", areaCounts: "", detailShards: "" }),
  ).toBeUndefined();
});
