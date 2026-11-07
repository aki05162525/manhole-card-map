import { expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createCardCatalog } from "../../domain/card-catalog";
import type { Card, Data } from "../../domain/types";

it("renders an ended card with null source fields without unmounting the application", async () => {
  const { CardDetail } = await import("./card-detail");
  // Real-data shape for 01-231-B001.
  const card: Card = {
    id: "01-231-B001",
    city: "恵庭市 (B001)",
    pref: "北海道",
    series: "第13弾",
    issued: "2020/12/17",
    status: "ended",
    lid: {
      status: "confirmed",
      lat: 42.90241666666667,
      lng: 141.5735,
    },
    placeText: null,
    hours: null,
    links: null,
    acquired: "2026-10-21",
  };
  const data: Data = {
    schema: 1,
    updated: "",
    cards: [card],
    places: [],
    relations: [],
    pins: [],
  };
  const html = renderToStaticMarkup(
    createElement(CardDetail, {
      card,
      data,
      catalog: createCardCatalog(data),
      onShowLid() {},
      onShowPlaces() {},
      mapReady: true,
    }),
  );
  expect(html).not.toContain("01-231-B001");
  expect(html).not.toContain("source-notes");
  expect(html).toContain("配布施設の登録なし");
  expect(html).toContain("蓋の位置へ");
  expect(html).not.toContain("配布場所を見る");
  expect(html).not.toContain("詳細パネル比較");
  const lidHtml = renderToStaticMarkup(
    createElement(CardDetail, {
      card,
      data,
      catalog: createCardCatalog(data),
      showingLid: true,
      mapReady: true,
      onShowLid() {},
      onShowPlaces() {},
    }),
  );
  expect(lidHtml).toContain("配布場所に戻る");
  expect(lidHtml).not.toContain("蓋の位置へ");
  expect(html).not.toContain("42.90241666666667%2C141.5735");
  expect(lidHtml).toContain("42.90241666666667%2C141.5735");
});

it.each([
  ["confirmed", "valid"],
  ["needs-review", "valid"],
  ["withdrawn", "valid"],
  ["withdrawn", "needs-review"],
  ["confirmed", "needs-review"],
] as const)(
  "keeps a %s facility searchable and in detail without claiming its old coordinates are confirmed",
  async (status, addressStatus) => {
    const { CardDetail } = await import("./card-detail");
    const { matchingCards, visiblePins } =
      await import("../../domain/card-selection");
    const card: Card = {
      id: "TEST-LOCATION",
      city: "試験市",
      pref: "試験県",
      series: "試験",
      issued: "2026-11-05",
      acquired: "2026-11-05",
      status: "active",
      lid: { status: "unconfirmed" },
      placeText: [],
      hours: [],
      links: [],
    };
    const data: Data = {
      schema: 1,
      updated: "2026-11-05",
      cards: [card],
      places: [
        {
          id: "facility:test",
          name: "試験案内所",
          address: "試験市 新住所",
          phone: "",
          coordinate: {
            status: "confirmed",
            lat: 35,
            lng: 139,
          },
          locationReview: {
            status,
            addressStatus,
            reason: "移転情報を確認中",
          },
        },
      ],
      relations: [
        {
          cardId: card.id,
          placeId: "facility:test",
          condition: "",
          periodRaw: "",
          alternativeRaw: "",
          review: "verified",
          status: "active",
          evidence: {
            sourceUrl: "https://example.com/source",
            checkedAt: "2026-11-05",
          },
        },
      ],
      pins: [
        {
          id: "facility:test",
          cardIds: [card.id],
          kind: "place",
          pref: "東京都",
          status: "active",
          lat: 35,
          lng: 139,
          reference: false,
        },
      ],
    };
    expect(matchingCards(data.cards, "試験案内所", data)).toEqual([card]);
    if (status !== "confirmed" || addressStatus !== "valid")
      expect(visiblePins(data, false)).toEqual([]);
    const html = renderToStaticMarkup(
      createElement(CardDetail, {
        card,
        data,
        catalog: createCardCatalog(data),
        onShowLid() {},
        onShowPlaces() {},
        mapReady: true,
      }),
    );
    expect(html).toContain("試験案内所");
    expect(html).not.toContain(card.id);
    expect(html).not.toContain("status-badge");
    expect(html).not.toContain("情報確認日");
    expect(html).toContain("この配布情報の出典");
    if (status === "confirmed" && addressStatus === "valid") {
      expect(html).not.toContain("位置確定");
      return;
    }
    expect(html).toContain(
      status === "withdrawn"
        ? "施設位置は取り下げ済み"
        : "施設位置は再確認待ち",
    );
    expect(html).not.toContain("位置確定");
    expect(html).not.toContain("35%2C139");
    expect(html).not.toContain("配布場所を見る");
    if (addressStatus === "valid") {
      expect(html).toContain("施設名・住所で検索");
    } else {
      expect(html).not.toContain("google.com/maps");
      expect(html).toContain("住所も再確認待ちです");
      expect(html).toContain("移転情報を確認中");
    }
  },
);

it("renders catalog detail without map callbacks and with explicit null fallbacks", async () => {
  const { CardDetail } = await import("./card-detail");
  const card: Card = {
    id: "01-231-B001",
    city: "試験市",
    pref: "北海道",
    series: "第13弾",
    issued: "2020/12/17",
    status: "ended",
    lid: { status: "confirmed", lat: 42, lng: 141 },
    placeText: null,
    hours: null,
    links: null,
    acquired: "2026-10-21",
  };
  const data: Data = {
    schema: 1,
    updated: "",
    cards: [card],
    places: [],
    relations: [],
    pins: [],
  };
  const html = renderToStaticMarkup(
    createElement(CardDetail, {
      card,
      data,
      catalog: createCardCatalog(data),
      variant: "catalog",
      actions: createElement("a", { href: "/" }, "地図"),
    }),
  );
  for (const text of [
    card.id,
    card.series,
    card.issued,
    "配布時間の記載なし",
    "原文リンクの記載なし",
    "配布施設の登録なし",
    "配布終了",
    "蓋のGoogleマップへ",
  ])
    expect(html).toContain(text);
  expect(html).not.toContain("<button");
  expect(html).not.toContain("蓋の位置へ");
  expect(html).toContain('href="/"');
});

it("keeps all relation conditions and statuses in catalog detail and suppresses unsafe map links", async () => {
  const { CardDetail } = await import("./card-detail");
  const card: Card = {
    id: "01-100-C001",
    city: "複数窓口市",
    pref: "北海道",
    series: "第20弾",
    issued: "",
    acquired: "",
    status: "unknown",
    lid: { status: "unconfirmed" },
    placeText: ["原文の未採用施設"],
    hours: ["原文時間"],
    links: [
      "javascript:alert(1)",
      "https://example.com/original",
      "https://example.com/original",
    ],
  };
  const data: Data = {
    schema: 1,
    updated: "",
    cards: [card],
    places: [
      {
        id: "a",
        name: "同じ施設",
        address: "住所",
        phone: "",
        coordinate: { status: "unconfirmed" },
      },
      {
        id: "b",
        name: "移転確認中",
        address: "旧住所",
        phone: "",
        coordinate: { status: "confirmed", lat: 35, lng: 139 },
        locationReview: {
          status: "confirmed",
          addressStatus: "needs-review",
          reason: "移転情報",
        },
      },
    ],
    relations: [
      {
        cardId: card.id,
        placeId: "a",
        condition: "平日限定",
        periodRaw: "夏季",
        alternativeRaw: "冬は別窓口",
        hours: ["9時〜17時"],
        status: "active",
        review: "verified",
        validFrom: "2026-05-01",
        validTo: "2026-10-31",
      },
      {
        cardId: card.id,
        placeId: "a",
        condition: "休日限定",
        periodRaw: "冬季",
        alternativeRaw: "",
        status: "suspended",
        review: "needs-review",
        evidence: {
          sourceUrl: "https://example.com/review",
          checkedAt: "2026-11-06",
        },
      },
      {
        cardId: card.id,
        placeId: "b",
        condition: "",
        periodRaw: "",
        alternativeRaw: "",
        status: "ended",
      },
    ],
    pins: [],
  };
  const html = renderToStaticMarkup(
    createElement(CardDetail, {
      card,
      data,
      catalog: createCardCatalog(data),
      variant: "catalog",
    }),
  );
  for (const text of [
    "平日限定",
    "休日限定",
    "夏季",
    "冬季",
    "冬は別窓口",
    "9時〜17時",
    "2026-05-01",
    "2026-10-31",
    "配布中",
    "一時中止",
    "配布終了",
    "再確認待ち",
    "施設名・住所で検索",
    "住所も再確認待ち",
    "原文時間",
    "カードの原文リンク",
  ])
    expect(html).toContain(text);
  expect(html).not.toContain("原文の未採用施設");
  expect(html).not.toContain("javascript:");
  expect(html).not.toContain("35%2C139");
  expect(html.match(/https:\/\/example.com\/original/g)).toHaveLength(1);
  expect(html.match(/<h3>同じ施設<\/h3>/g)).toHaveLength(2);
  expect(html).not.toContain("<button");
});

it("shows original place text as unstructured supplementation only without registered facilities", async () => {
  const { CardDetail } = await import("./card-detail");
  const card: Card = {
    id: "01-406-A001",
    city: "試験町",
    pref: "北海道",
    series: "",
    issued: "",
    acquired: "",
    status: "active",
    lid: { status: "unconfirmed" },
    placeText: ["原文の窓口", "原文の住所"],
    hours: null,
    links: null,
  };
  const data: Data = {
    schema: 1,
    updated: "",
    cards: [card],
    places: [],
    relations: [],
    pins: [],
  };
  const html = renderToStaticMarkup(
    createElement(CardDetail, {
      card,
      data,
      catalog: createCardCatalog(data),
      variant: "catalog",
    }),
  );
  expect(html).toContain("構造化した施設情報の補足");
  expect(html).toContain("原文の窓口");
  expect(html).toContain("原文の住所");
  expect(html).not.toContain("google.com/maps");
});
