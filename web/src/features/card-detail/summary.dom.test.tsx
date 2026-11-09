import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CardDetail } from "./card-detail";
import type { Card, Data } from "../../domain/types";
const card: Card = {
  id: "test",
  pref: "県",
  city: "市",
  series: "第1弾",
  issued: "",
  acquired: "",
  status: "active",
  lid: { status: "confirmed", lat: 35, lng: 139 },
  hours: ["9時〜17時"],
  links: ["https://example.com"],
  placeText: null,
};
const data: Data = {
  schema: 1,
  updated: "",
  evaluatedAt: "2026-11-01",
  cards: [card],
  pins: [],
  places: [
    {
      id: "a",
      name: "施設名",
      address: "住所は詳細だけ",
      phone: "",
      coordinate: { status: "confirmed", lat: 35, lng: 139 },
    },
  ],
  relations: [
    {
      cardId: "test",
      placeId: "a",
      condition: "",
      periodRaw: "",
      alternativeRaw: "",
    },
  ],
};
beforeEach(() =>
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  ),
);
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
function setup(c = card, d = data) {
  const expand = vi.fn();
  const result = render(
    <CardDetail
      card={c}
      data={d}
      catalog={null}
      onExpand={expand}
      summaryMode
    />,
  );
  return {
    ...result,
    expand,
    summary: result.container.querySelector(".sheet-summary")!,
  };
}
it("keeps status, stock disclaimer, date and route together without address", () => {
  const { summary } = setup();
  for (const text of [
    "施設名",
    "配布中",
    "在庫は保証されません",
    "2026-11-01",
    "9時〜17時",
    "Googleマップで経路",
    "詳しく",
  ])
    expect(summary.textContent).toContain(text);
  expect(summary.textContent).not.toContain("住所は詳細だけ");
});
it("opens full details from the explicit button", () => {
  const { getByRole, expand } = setup();
  fireEvent.click(getByRole("button", { name: "詳しく" }));
  expect(expand).toHaveBeenCalled();
});
it("shows a single original in full when it fits two lines", () => {
  const { summary } = setup();
  expect(summary.querySelector(".distribution-hours")?.textContent).toBe(
    "9時〜17時",
  );
  expect(
    summary
      .querySelector(".hours-continue")
      ?.classList.contains("has-overflow"),
  ).toBe(false);
});
it("offers the full original when measured hours overflow", () => {
  vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(80);
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(48);
  const { summary, expand } = setup();
  fireEvent.click(summary.querySelector(".hours-continue")!);
  expect(summary.textContent).toContain("続きあり・全文は詳しく ›");
  expect(expand).toHaveBeenCalledWith("hours");
});
it("labels multiple periods instead of previewing the first", () => {
  const { summary } = setup({ ...card, hours: ["平日9時", "休日10時"] });
  expect(summary.textContent).toContain(
    "配布時間は時期・曜日で異なります（2区分）›",
  );
});
it.each(["suspended", "ended"] as const)(
  "omits summary hours for %s",
  (status) => {
    const { summary } = setup({ ...card, status });
    expect(summary.querySelector(".detail-status-band")).not.toBeNull();
    expect(summary.querySelector(".distribution-hours")).toBeNull();
    if (status === "ended")
      expect(
        summary.querySelector(".primary-destination")?.textContent,
      ).toContain("蓋の場所");
  },
);
it("offers source for absent hours and address search for an unconfirmed location", () => {
  const { summary } = setup(
    { ...card, hours: null },
    {
      ...data,
      places: [{ ...data.places[0], coordinate: { status: "unconfirmed" } }],
    },
  );
  expect(summary.textContent).toContain("配布時間の記載なし");
  expect(summary.textContent).toContain("Googleマップで住所を検索");
  expect(
    summary.querySelector('a[href="https://example.com/"]'),
  ).not.toBeNull();
});
it("opens the other counters from the summary", () => {
  const { summary, expand } = setup(card, {
    ...data,
    places: [...data.places, { ...data.places[0], id: "b" }],
    relations: [...data.relations, { ...data.relations[0], placeId: "b" }],
  });
  const button = Array.from(summary.querySelectorAll("button")).find((b) =>
    b.textContent?.includes("この地点・ほか1か所"),
  )!;
  fireEvent.click(button);
  expect(expand).toHaveBeenCalledWith("places");
});

it("keeps primary destinations as the final child outside the supporting content", () => {
  const { container } = setup();
  const destinations = container.querySelector(".detail-destinations")!;
  expect(destinations.parentElement?.className).toBe("card-detail-content");
  expect(destinations.parentElement?.lastElementChild).toBe(destinations);
});
