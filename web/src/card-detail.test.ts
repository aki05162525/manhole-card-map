import { expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { Card, Data } from "./types";

it("renders an ended card with null source fields without unmounting the application", async () => {
  const { CardDetail } = await import("./card-detail");
  // Real-data shape for 01-231-B001; the current Card type incorrectly excludes null.
  const card = {
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
  } as unknown as Card;
  const data = {
    cards: [card],
    places: [],
    relations: [],
    pins: [],
  } as unknown as Data;
  const html = renderToStaticMarkup(
    createElement(CardDetail, {
      card,
      data,
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
    const { matchingCards, visiblePins } = await import("./explorer-state");
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
