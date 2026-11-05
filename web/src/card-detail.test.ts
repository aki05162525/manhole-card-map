import { afterAll, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { Card, Data } from "./types";

vi.mock("./card-map", () => ({ default: () => null }));
vi.stubGlobal("location", { search: "" });
vi.stubGlobal("window", {});
afterAll(() => vi.unstubAllGlobals());

it("renders an ended card with null source fields without unmounting the application", async () => {
  const { CardDetail } = await import("./app");
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
      review: "OCR 自動照合",
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
  expect(html).toContain("01-231-B001");
  expect(html).toContain("配布終了");
  expect(html).toContain("配布施設の登録なし");
  expect(html).toContain("このカードの蓋を見る");
  expect(html).toContain("42.90241666666667%2C141.5735");
});
