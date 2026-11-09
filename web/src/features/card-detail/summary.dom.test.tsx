import { useState } from "react";
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
  lid: { status: "confirmed", lat: 36, lng: 140 },
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
it("keeps status and route together without address, stock or date notes", () => {
  const { summary } = setup();
  expect(summary.textContent).not.toContain("在庫は保証されません");
  expect(summary.textContent).not.toContain("基準日");
  for (const text of [
    "施設名",
    "配布中",
    "9時〜17時",
    "配布場所へ経路",
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
      ).toContain("蓋へ経路");
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
  expect(summary.textContent).toContain("住所で検索");
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
it("does not repeat a single original that already fits in the summary", () => {
  const { container } = setup();
  expect(container.querySelectorAll(".distribution-hours")).toHaveLength(1);
  expect(container.querySelector(".detail-full-hours")).toBeNull();
});
it("keeps the full original below when the summary had to truncate it", () => {
  vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(80);
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(48);
  const { container } = setup();
  expect(container.querySelector(".detail-full-hours")?.textContent).toBe(
    "9時〜17時",
  );
});

function LidDetail({ c = card }: { c?: Card }) {
  const [showingLid, setShowingLid] = useState(false);
  const [target, setTarget] = useState<HTMLDivElement | null>(null);
  return (
    <>
      <CardDetail
        card={c}
        data={data}
        catalog={null}
        onExpand={() => {}}
        summaryMode
        actionContainer={target}
        showingLid={showingLid}
        mapReady
        onShowLid={() => setShowingLid(true)}
        onShowPlaces={() => setShowingLid(false)}
      />
      <div ref={setTarget} />
    </>
  );
}
it("switches the summary and primary destination to the lid and back", () => {
  const { getByRole, container } = render(<LidDetail />);
  const primary = () =>
    container.querySelector<HTMLAnchorElement>(".primary-destination")!;
  expect(primary().textContent).toContain("配布場所へ経路");
  fireEvent.click(getByRole("button", { name: "蓋の場所" }));
  expect(primary().textContent).toContain("蓋へ経路");
  expect(new URL(primary().href).pathname).toBe("/maps/dir/");
  expect(new URL(primary().href).searchParams.get("destination")).toBe(
    "36,140",
  );
  const summary = container.querySelector(".sheet-summary")!;
  expect(summary.querySelector("h3")?.textContent).toBe("マンホール蓋の位置");
  expect(summary.textContent).toContain(
    "カード記載の座標です。現地で確かめてください",
  );
  expect(summary.textContent).toContain("配布場所：施設名");
  expect(summary.querySelector(".distribution-hours")).toBeNull();
  expect(summary.querySelector(".facility-heading")).toBeNull();
  expect(primary().querySelector("svg circle")).not.toBeNull();
  expect(getByRole("button", { name: "詳しく" })).toBeTruthy();
  fireEvent.click(getByRole("button", { name: "配布場所に戻る" }));
  expect(primary().textContent).toContain("配布場所へ経路");
  expect(primary().querySelector("svg rect")).not.toBeNull();
  expect(new URL(primary().href).searchParams.get("destination")).toBe(
    "35,139",
  );
  expect(container.querySelector(".sheet-summary h3")?.textContent).toBe(
    "施設名",
  );
  fireEvent.click(getByRole("button", { name: "蓋の場所" }));
  fireEvent.click(getByRole("button", { name: /配布場所：施設名/ }));
  expect(primary().textContent).toContain("配布場所へ経路");
});
it("never offers lid mode without confirmed coordinates", () => {
  const { queryByRole } = render(
    <LidDetail c={{ ...card, lid: { status: "unconfirmed" } }} />,
  );
  expect(queryByRole("button", { name: "蓋の場所" })).toBeNull();
});
it("uses the lid route as the ended card primary action", () => {
  const { container } = render(<LidDetail c={{ ...card, status: "ended" }} />);
  const primary = container.querySelector<HTMLAnchorElement>(
    ".primary-destination",
  )!;
  expect(primary.textContent).toContain("蓋へ経路");
  expect(new URL(primary.href).pathname).toBe("/maps/dir/");
});
it("keeps unconfirmed address search and suspended place viewing on Maps search", () => {
  for (const [c, d, label, query] of [
    [
      card,
      {
        ...data,
        places: [{ ...data.places[0], coordinate: { status: "unconfirmed" } }],
      },
      "住所で検索",
      "施設名 住所は詳細だけ",
    ],
    [{ ...card, status: "suspended" }, data, "場所を見る", "35,139"],
  ] as const) {
    const { container, unmount } = render(
      <CardDetail
        card={c}
        data={d as Data}
        catalog={null}
        onExpand={() => {}}
        summaryMode
      />,
    );
    const primary = container.querySelector<HTMLAnchorElement>(
      ".primary-destination",
    )!;
    expect(primary.textContent).toContain(label);
    const url = new URL(primary.href);
    expect(url.pathname).toBe("/maps/search/");
    expect(url.searchParams.get("query")).toBe(query);
    unmount();
  }
});
