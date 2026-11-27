import { expect, it } from "vitest";
import {
  detailData,
  detailShard,
  publicViews,
  type DetailFile,
  type PinsFile,
  type PlacesFile,
  type SearchFile,
} from "./public-views";
import type { Data } from "./types";

const card = (
  id: string,
  city: string,
  pref: string,
): Data["cards"][number] => ({
  id,
  city,
  pref,
  series: "",
  issued: "",
  acquired: "",
  status: "active",
  lid: { status: "unconfirmed" },
  placeText: null,
  hours: null,
  links: null,
});
const place = (
  id: string,
  status: "confirmed" | "candidate" = "confirmed",
): Data["places"][number] => ({
  id,
  name: `施設${id}`,
  address: `住所${id}`,
  phone: "",
  coordinate: { status, lat: 35, lng: 139 },
});
const relation = (cardId: string, placeId: string) => ({
  cardId,
  placeId,
  condition: "",
  periodRaw: "",
  alternativeRaw: "",
});
const pin = (
  id: string,
  cardIds: string[],
  kind: "place" | "lid" = "place",
) => ({
  id,
  kind,
  cardIds,
  pref: "",
  lat: 35,
  lng: 139,
  status: "active" as const,
});
const TOKYO = "13-101-A001",
  KANAGAWA = "14-100-A001",
  UNPLACED = "13-104-A001",
  NATIONAL = "00-101-A001";
const data: Data = {
  schema: 1,
  updated: "2026-10-21",
  evaluatedAt: "2026-11-19",
  cardAliases: { "13-999-Z999": TOKYO },
  cards: [
    card(KANAGAWA, "横浜市", "神奈川県"),
    card(TOKYO, "千代田区", "東京都"),
    card(UNPLACED, "新宿区", "東京都"),
    card(NATIONAL, "日本下水道事業団", ""),
  ],
  places: [
    place("shared"),
    place("candidate", "candidate"),
    {
      ...place("withdrawn"),
      locationReview: { status: "withdrawn", reason: "移転" },
    },
  ],
  relations: [
    relation(TOKYO, "shared"),
    relation(KANAGAWA, "shared"),
    relation(UNPLACED, "candidate"),
    relation(NATIONAL, "withdrawn"),
  ],
  pins: [
    pin("shared", [KANAGAWA, TOKYO]),
    pin("withdrawn", [NATIONAL]),
    pin(`lid:${TOKYO}`, [TOKYO], "lid"),
  ],
};
const views = publicViews(data);

it("keeps a card's details in the file of its number's prefecture code", () => {
  expect([TOKYO, NATIONAL, "a", ""].map(detailShard)).toEqual([
    "13",
    "00",
    "00",
    "00",
  ]);
});

it("cuts the data into the map's pins, the search index and one file a prefecture", () => {
  expect(
    Object.keys(views)
      .filter((name) => !name.startsWith("places-"))
      .sort(),
  ).toEqual([
    "detail-00.json",
    "detail-13.json",
    "detail-14.json",
    "pins.json",
    "search.json",
  ]);
  expect(views["pins.json"]).toEqual({
    schema: 1,
    updated: "2026-10-21",
    evaluatedAt: "2026-11-19",
    cardAliases: data.cardAliases,
    shards: ["00", "13", "14"],
    // Drawn without the places: a withdrawn position has no pin to draw.
    pins: [data.pins[0], data.pins[2]],
  });
  // Every card is in exactly one file, with all of its relations and the
  // places they name; a place two prefectures share is in both.
  const details = ["00", "13", "14"].map(
    (shard) => views[`detail-${shard}.json`] as DetailFile,
  );
  expect(details.map((file) => file.cards.map((item) => item.id))).toEqual([
    [NATIONAL],
    [TOKYO, UNPLACED],
    [KANAGAWA],
  ]);
  expect(details.map((file) => file.places.map((item) => item.id))).toEqual([
    ["withdrawn"],
    ["shared", "candidate"],
    ["shared"],
  ]);
  expect(details.flatMap((file) => file.relations)).toHaveLength(
    data.relations.length,
  );
  for (const file of details)
    expect(file).toMatchObject({ schema: 1, updated: "2026-10-21" });
});

it("lists every card for the search with its places and why it has no pin", () => {
  const search = views["search.json"] as SearchFile;
  // The catalog's order: by prefecture code, the unregistered last.
  expect(search.cards).toEqual([
    {
      id: TOKYO,
      city: "千代田区",
      pref: "東京都",
      status: "active",
      places: [{ name: "施設shared", address: "住所shared" }],
      hasPin: true,
      pinReasons: [],
    },
    expect.objectContaining({
      id: UNPLACED,
      places: [{ name: "施設candidate", address: "住所candidate" }],
      hasPin: false,
      pinReasons: ["location-unconfirmed"],
    }),
    expect.objectContaining({ id: KANAGAWA, hasPin: true }),
    expect.objectContaining({
      id: NATIONAL,
      pref: "",
      hasPin: false,
      pinReasons: ["location-unconfirmed"],
    }),
  ]);
});

it("joins received details into data that holds everything of their cards", () => {
  const joined = detailData(views["pins.json"] as PinsFile, [
    views["detail-13.json"] as DetailFile,
    views["detail-14.json"] as DetailFile,
  ]);
  expect(joined.cards.map((item) => item.id)).toEqual([
    TOKYO,
    UNPLACED,
    KANAGAWA,
  ]);
  expect(joined.places.map((item) => item.id)).toEqual(["shared", "candidate"]);
  expect(joined.relations).toHaveLength(3);
  expect(joined.pins).toEqual([data.pins[0], data.pins[2]]);
  expect(joined).toMatchObject({
    evaluatedAt: "2026-11-19",
    cardAliases: data.cardAliases,
  });
});

it("refuses a relation whose card is not in the data", () => {
  expect(() =>
    publicViews({ ...data, relations: [relation("13-000-X000", "shared")] }),
  ).toThrow("カードのない配布関係");
});

it("gives each prefecture its facilities by where they stand, a shared one as one pin with all its cards", () => {
  const at = (id: string, pref: string, cardIds: string[]) => ({
    ...pin(id, cardIds),
    pref,
    lat: pref === "東京都" ? 35.68 : 35.44,
    lng: pref === "東京都" ? 139.76 : 139.64,
  });
  const views = publicViews(
    {
      ...data,
      places: [...data.places, place("yokohama"), place("lid-only")],
      relations: [...data.relations, relation(TOKYO, "yokohama")],
      pins: [
        // A Tokyo facility handing out a Kanagawa card too.
        at("shared", "東京都", [KANAGAWA, TOKYO]),
        // A Tokyo card handed out in Kanagawa.
        at("yokohama", "神奈川県", [TOKYO]),
        // A withdrawn position and a lid are not facilities to draw.
        at("withdrawn", "東京都", [NATIONAL]),
        { ...at("lid-only", "東京都", [TOKYO]), kind: "lid" as const },
      ],
    },
    {
      features: [
        {
          properties: { p: ["13", "14"] },
          geometry: {
            coordinates: [
              [139.5, 35.6],
              [139.6, 35.5],
            ],
          },
        },
        {
          properties: { p: ["11", "12"] },
          geometry: {
            coordinates: [
              [139.9, 36],
              [140, 36.1],
            ],
          },
        },
      ],
    },
  );
  const tokyo = views["places-13.json"] as PlacesFile;
  const kanagawa = views["places-14.json"] as PlacesFile;
  expect(tokyo).toEqual({
    schema: 1,
    updated: "2026-10-21",
    evaluatedAt: "2026-11-19",
    pref: "東京都",
    pins: [
      {
        id: "shared",
        name: "施設shared",
        cardIds: [KANAGAWA, TOKYO],
        status: "active",
        lat: 35.68,
        lng: 139.76,
      },
    ],
    borders: [
      [
        [139.5, 35.6],
        [139.6, 35.5],
      ],
    ],
  });
  expect(kanagawa.pins.map((item) => [item.id, item.cardIds])).toEqual([
    ["yokohama", [TOKYO]],
  ]);
  expect(kanagawa.borders).toEqual(tokyo.borders);
  // Every prefecture has its file, with or without facilities.
  const places = Object.keys(views).filter((name) =>
    name.startsWith("places-"),
  );
  expect(places).toHaveLength(47);
  expect((views["places-47.json"] as PlacesFile).pins).toEqual([]);
});
