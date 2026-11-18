import { cleanup, fireEvent, render, within } from "@testing-library/react";
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
/** The page's part: it keeps the stop, and is told of each choice. */
const page = {
  showingLid: false,
  onShowLid() {},
  onShowPlaces() {},
  onChoosePlace() {},
};
function setup(c = card, d = data, pin?: string) {
  const expand = vi.fn();
  const result = render(
    <CardDetail
      {...page}
      card={c}
      data={d}
      onExpand={expand}
      selectedPinId={pin}
    />,
  );
  return {
    ...result,
    expand,
    summary: result.container.querySelector(".sheet-summary")!,
  };
}
const twoCounters: Data = {
  ...data,
  places: [
    ...data.places,
    {
      ...data.places[0],
      id: "b",
      name: "休日窓口",
      coordinate: { status: "confirmed", lat: 37, lng: 141 },
    },
  ],
  relations: [
    {
      ...data.relations[0],
      hours: ["平日9時"],
      applies: {
        kind: "calendar",
        weekdays: [1, 2, 3, 4, 5],
        holiday: "exclude",
      },
    },
    { ...data.relations[0], placeId: "b", hours: ["休日10時"] },
  ],
};
it("chooses one counter, and tells the page of each stop and counter chosen", () => {
  const told = {
    onShowLid: vi.fn(),
    onShowPlaces: vi.fn(),
    onChoosePlace: vi.fn(),
  };
  const detail = (showingLid: boolean) => (
    <CardDetail
      {...told}
      showingLid={showingLid}
      card={card}
      data={twoCounters}
      selectedPinId="b"
    />
  );
  const view = render(detail(false));
  /** The stops marked as the current step. */
  const current = () =>
    view
      .getAllByRole("button", { current: "step" })
      .map((stop) => stop.textContent);
  // The tapped pin's counter is chosen, and only it shows its hours.
  expect(
    (view.getByRole("radio", { name: "休日窓口" }) as HTMLInputElement).checked,
  ).toBe(true);
  expect(view.queryByText("平日9時")).toBeNull();
  fireEvent.click(view.getByRole("radio", { name: "平日 施設名" }));
  expect(told.onChoosePlace).toHaveBeenLastCalledWith("a");
  expect(view.getByText("平日9時")).toBeTruthy();
  expect(view.queryByText("休日10時")).toBeNull();
  expect(
    view.getByRole("link", { name: "配布場所へ行く" }).getAttribute("href"),
  ).toContain("35%2C139");
  expect(current()).toEqual(["① 受け取る"]);
  // The other stop is the page's to show.
  fireEvent.click(view.getByRole("button", { name: "② 蓋を訪ねる" }));
  expect(told.onShowLid).toHaveBeenCalledTimes(1);
  expect(current()).toEqual(["① 受け取る"]);
  view.rerender(detail(true));
  expect(current()).toEqual(["② 蓋を訪ねる"]);
  expect(view.getAllByRole("link", { name: /行く/ })).toHaveLength(1);
  expect(
    view.getByRole("link", { name: "蓋へ行く" }).getAttribute("href"),
  ).toContain("36%2C140");
  fireEvent.click(view.getByRole("button", { name: "① 受け取る" }));
  expect(told.onShowPlaces).toHaveBeenCalledTimes(1);
  expect(told.onShowLid).toHaveBeenCalledTimes(1);
});
it("offers several counters as one choice, and a card's only counter as none", () => {
  const several = setup(card, twoCounters);
  expect(
    within(several.getByRole("group", { name: "窓口を選ぶ" })).getAllByRole(
      "radio",
    ),
  ).toHaveLength(2);
  several.unmount();
  const only = setup();
  expect(only.queryByRole("group")).toBeNull();
  expect(only.queryByRole("radio")).toBeNull();
});
/** What the chosen counter says under its status and hours. */
const said = (view: ReturnType<typeof setup>) =>
  [...view.container.querySelectorAll(".counter-more p")].map(
    (node) => node.textContent,
  );
const counter = (relation: Partial<Data["relations"][number]>): Data => ({
  ...data,
  relations: [{ ...data.relations[0], ...relation }],
});
it("says once what the ledger repeats as both the hours and the condition", () => {
  const view = setup(
    card,
    counter({
      hours: ["平日9時〜17時"],
      condition: "平日9時〜17時",
      periodRaw: "夏季のみ",
      alternativeRaw: "冬は別窓口",
    }),
  );
  expect(said(view)).toEqual(["夏季のみ\n冬は別窓口"]);
});
it.each([
  [
    "both ends",
    { validFrom: "2026-05-01", validTo: "2026-10-31" },
    ["適用期間：2026-05-01 ～ 2026-10-31"],
  ],
  [
    "only its end",
    { validTo: "2026-10-31" },
    ["適用期間：開始日未確認 ～ 2026-10-31"],
  ],
  [
    "only its start",
    { validFrom: "2026-05-01" },
    ["適用期間：2026-05-01 ～ 終了日未指定"],
  ],
  ["neither end", {}, []],
])("says the period a counter applies for, given %s", (_, period, text) => {
  expect(said(setup(card, counter(period)))).toEqual(text);
});
it("says that a counter's hours or its distribution are unconfirmed only where they are", () => {
  const hours = "配布時間は未確認です。出典をご確認ください。";
  const review = "配布情報は未確認です。出典をご確認ください。";
  const unconfirmed = setup(
    { ...card, hours: null },
    counter({ review: "needs-review" }),
  );
  expect(unconfirmed.getByText(hours)).toBeTruthy();
  expect(said(unconfirmed)).toEqual([review]);
  unconfirmed.unmount();
  const confirmed = setup(card, counter({ review: "verified" }));
  expect(confirmed.queryByText(hours)).toBeNull();
  expect(said(confirmed)).toEqual([]);
});
it("says the prefecture, the series and the number under the name, without a gap for a series not given", () => {
  const prelude = (view: ReturnType<typeof setup>) =>
    view.container.querySelector(".detail-prelude")?.textContent;
  const view = setup();
  expect(prelude(view)).toBe("県 · 第1弾 · test");
  view.unmount();
  expect(prelude(setup({ ...card, series: "" }))).toBe("県 · test");
});
it("links the card's source where no place is registered to receive it", () => {
  const view = setup(card, { ...data, places: [], relations: [] });
  expect(
    view.getByRole("link", { name: "配布情報の出典" }).getAttribute("href"),
  ).toBe("https://example.com/");
});
it("has one stop that is not a control when the lid has no coordinates", () => {
  const view = setup({ ...card, lid: { status: "unconfirmed" } });
  expect(view.getByRole("heading", { name: "① 受け取る" })).toBeTruthy();
  expect(
    view.queryByRole("button", { name: /受け取る|蓋を訪ねる/ }),
  ).toBeNull();
});
it("shows full hours without a continuation control", () => {
  const view = setup({ ...card, hours: ["平日9時", "休日10時"] });
  expect(view.container.querySelector(".distribution-hours")?.textContent).toBe(
    "平日9時\n休日10時",
  );
  expect(view.queryByText(/続きあり/)).toBeNull();
});
it("offers the other counters from the summary, where only the chosen one shows", () => {
  const view = setup(card, twoCounters);
  fireEvent.click(view.getByRole("button", { name: "ほか1か所" }));
  expect(view.expand).toHaveBeenLastCalledWith("places");
  // The current stop is not a switch: like the text under it, it widens.
  fireEvent.click(view.getByRole("button", { name: "① 受け取る" }));
  expect(view.expand).toHaveBeenLastCalledWith();
  expect(
    view.getByRole("button", { name: "① 受け取る", current: "step" }),
  ).toBeTruthy();
  view.unmount();
  expect(setup().queryByRole("button", { name: /ほか/ })).toBeNull();
});
it("does not count a second condition at the same place as another place", () => {
  // Two periods of one counter: one place to go, not "ほか1か所".
  const view = setup(card, {
    ...data,
    relations: [
      { ...data.relations[0], hours: ["4〜9月 9時"], validTo: "2026-09-30" },
      {
        ...data.relations[0],
        hours: ["10〜3月 10時"],
        validFrom: "2026-10-01",
      },
    ],
  });
  expect(view.queryByRole("button", { name: /か所/ })).toBeNull();
  expect(view.getByRole("button", { name: "ほかの条件1件" })).toBeTruthy();
});
it("adds a counter's planned change without another choice or destination", () => {
  const planned: Data = {
    ...data,
    relations: [
      {
        ...data.relations[0],
        status: "suspended",
        hours: ["10時〜18時"],
        validTo: "2026-12-22",
        upcoming: [
          { validFrom: "2026-12-23", status: "active", condition: "" },
        ],
      },
    ],
  };
  const view = render(
    <CardDetail {...page} card={card} data={planned} onExpand={() => {}} />,
  );
  const list = view.getByRole("list", {
    name: "今後の変更（2026-11-01時点の予定）",
  });
  expect(within(list).getByRole("listitem").textContent).toBe(
    "2026-12-23から配布中",
  );
  expect(list.querySelector("time")?.getAttribute("datetime")).toBe(
    "2026-12-23",
  );
  // The plan is not today's status, another counter, or a place to go.
  expect(view.container.querySelector(".status-chip")?.textContent).toBe(
    "一時中止",
  );
  expect(view.getByText("配布は一時中止中です")).toBeTruthy();
  expect(view.queryByRole("radio")).toBeNull();
  expect(view.queryByRole("button", { name: /ほか/ })).toBeNull();
  expect(view.getAllByRole("link", { name: /行く|場所を見る/ })).toHaveLength(
    1,
  );
  expect(view.getByRole("link", { name: "場所を見る" })).toBeTruthy();
});
it("names the page once, and the stops under it", () => {
  const view = setup(card, twoCounters);
  expect(
    view
      .getAllByRole("heading")
      .map((node) => [node.tagName, node.textContent]),
  ).toEqual([
    ["H2", "市"],
    ["H3", "① 受け取る"],
    ["H3", "② 蓋を訪ねる"],
  ]);
  // No paragraph is drawn for a relation's empty free text.
  expect(
    [...view.container.querySelectorAll("p")].filter(
      (node) => !node.textContent?.trim(),
    ),
  ).toEqual([]);
});
it.each([
  ["a source to check", ["https://example.com/source"], "出典で確認する"],
  ["no bar at all", null, null],
] as const)(
  "leaves %s when the counter cannot be handed to a map",
  (_, links, name) => {
    // 14-218-B001, 34-212-C001: a place with neither a name nor an address.
    const bar = document.createElement("div");
    document.body.append(bar);
    const view = render(
      <CardDetail
        {...page}
        card={{ ...card, links: links && [...links], lid: { status: "none" } }}
        data={{
          ...data,
          places: [
            {
              ...data.places[0],
              name: "",
              address: "",
              coordinate: { status: "unconfirmed" },
            },
          ],
        }}
        actionContainer={bar}
      />,
    );
    expect(view.getByText("名称未確認の配布場所")).toBeTruthy();
    if (name)
      expect(within(bar).getByRole("link", { name }).getAttribute("href")).toBe(
        "https://example.com/source",
      );
    else expect(bar.childElementCount).toBe(0);
    bar.remove();
  },
);

it("puts one collected-state jump beside the first heading and expands to the record", async () => {
  vi.stubEnv("VITE_ACCOUNTS_ENABLED", "true");
  const { RecordsContext, inactive } =
    await import("../records/records-context");
  const twoPlaces: Data = {
    ...data,
    places: [...data.places, { ...data.places[0], id: "b", name: "別施設" }],
    relations: [...data.relations, { ...data.relations[0], placeId: "b" }],
  };
  const expand = vi.fn();
  const { container, getByRole } = render(
    <RecordsContext
      value={{
        ...inactive,
        phase: "ready",
        records: new Map([["test", { cardId: "test", receivedOn: null }]]),
      }}
    >
      <CardDetail {...page} card={card} data={twoPlaces} onExpand={expand} />
    </RecordsContext>,
  );
  expect(container.querySelectorAll(".record-stamp")).toHaveLength(1);
  expect(
    container.querySelector(
      ".sheet-summary .detail-stamp-heading .record-stamp",
    ),
  ).not.toBeNull();
  expect(
    container.querySelector(".record-editor")?.hasAttribute("hidden"),
  ).toBe(true);
  fireEvent.click(getByRole("button", { name: "入手済、入手の記録へ" }));
  expect(getByRole("region", { name: "入手の記録" })).toBeTruthy();
  expect(expand).toHaveBeenCalledWith("record");
  vi.unstubAllEnvs();
});

it("keeps one stamp for a paused multi-counter card", async () => {
  vi.stubEnv("VITE_ACCOUNTS_ENABLED", "true");
  const { RecordsContext, inactive } =
    await import("../records/records-context");
  const save = vi.fn(async () => {});
  for (const status of ["ended", "suspended"] as const) {
    const view = render(
      <RecordsContext
        value={{ ...inactive, phase: "ready", records: new Map(), save }}
      >
        <CardDetail
          {...page}
          card={{ ...card, status }}
          data={{
            ...data,
            places: [...data.places, { ...data.places[0], id: "b" }],
            relations: [
              ...data.relations,
              { ...data.relations[0], placeId: "b" },
            ],
          }}
        />
      </RecordsContext>,
    );
    expect(view.queryByRole("region", { name: "入手の記録" })).toBeNull();
    const stamps = view.getAllByRole("button", { name: "入手したら押す" });
    expect(stamps).toHaveLength(1);
    fireEvent.click(stamps[0]);
    expect(save).toHaveBeenLastCalledWith(
      "test",
      expect.objectContaining({ cardId: "test", memo: null }),
    );
    view.unmount();
  }
  vi.unstubAllEnvs();
});
