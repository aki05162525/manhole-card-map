import type { Card, Data } from "../src/types.ts";

const confirmed = (lat: number, lng: number) => ({
  status: "confirmed",
  lat,
  lng,
});
const card = (id: string, city: string, lat?: number, lng?: number): Card => ({
  id,
  city: `合成テスト：${city}`,
  pref: city.includes("大阪") ? "大阪府" : "東京都",
  series: "テスト",
  issued: "2000/01/01",
  status: "active",
  lid:
    lat === undefined || lng === undefined
      ? { status: "unconfirmed", reason: "位置なしのテスト" }
      : confirmed(lat, lng),
  placeText: [
    "これは検証用の架空カードです。訪問先として使用しないでください。",
  ],
  hours: ["平日・休日の条件を確認するテスト"],
  links: ["https://example.com/"],
  acquired: "2000-01-01",
});
const cards = [
  card("TEST-TOKYO-1", "東京A", 35.7, 139.78),
  card("TEST-TOKYO-2", "東京B", 35.7, 139.78),
  card("TEST-OSAKA", "大阪", 34.69, 135.5),
  card("TEST-ISLAND", "大島", 34.75, 139.36),
  card("TEST-UNKNOWN", "位置未確定"),
];
export const fixtureData: Data & { fixture: true } = {
  schema: 1,
  updated: "2000-01-01",
  fixture: true,
  cards,
  places: [
    {
      id: "test-shared",
      name: "合成テスト共同配布所",
      address: "テスト住所（訪問不可）",
      phone: "",
      coordinate: confirmed(35.6801, 139.7601),
    },
    {
      id: "test-alternative",
      name: "合成テスト休日配布所",
      address: "架空 & テスト #2",
      phone: "",
      coordinate: { ...confirmed(35.6802, 139.7602), status: "candidate" },
    },
  ],
  relations: [
    {
      cardId: cards[0]!.id,
      placeId: "test-shared",
      condition: "平日",
      hours: ["9:00–17:00（合成）"],
      status: "active",
      review: "verified",
      periodRaw: "",
      alternativeRaw: "",
    },
    {
      cardId: cards[1]!.id,
      placeId: "test-shared",
      condition: "毎日",
      periodRaw: "",
      alternativeRaw: "",
    },
    {
      cardId: cards[0]!.id,
      placeId: "test-alternative",
      condition: "休日",
      periodRaw: "当面の間",
      alternativeRaw: "平日の施設の休館時",
    },
  ],
  pins: [
    ...cards
      .filter((c) => c.lid.status === "confirmed")
      .map((c) => ({
        id: `lid-${c.id}`,
        kind: "lid" as const,
        pref: c.pref,
        cardIds: [c.id],
        status: c.status,
        lat: c.lid.lat!,
        lng: c.lid.lng!,
        reference: false,
      })),
    {
      id: "test-shared",
      kind: "place",
      pref: "東京都",
      cardIds: [cards[0]!.id, cards[1]!.id],
      status: "active",
      lat: 35.6801,
      lng: 139.7601,
      reference: false,
    },
  ],
};
