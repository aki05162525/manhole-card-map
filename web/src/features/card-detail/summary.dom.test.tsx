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
function setup(c = card, d = data, pin?: string) {
  const expand = vi.fn();
  const result = render(
    <CardDetail
      card={c}
      data={d}
      catalog={null}
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
      ...data.places[0]!,
      id: "b",
      name: "休日窓口",
      coordinate: { status: "confirmed", lat: 37, lng: 141 },
    },
  ],
  relations: [
    {
      ...data.relations[0]!,
      hours: ["平日9時"],
      applies: {
        kind: "calendar",
        weekdays: [1, 2, 3, 4, 5],
        holiday: "exclude",
      },
    },
    { ...data.relations[0]!, placeId: "b", hours: ["休日10時"] },
  ],
};
it.each(["map", "catalog"] as const)(
  "chooses one counter and one stop in %s",
  (variant) => {
    const view = render(
      <CardDetail
        card={card}
        data={twoCounters}
        catalog={null}
        variant={variant}
        selectedPinId="b"
      />,
    );
    // The tapped pin's counter is chosen, and only it shows its hours.
    expect(
      (view.getByRole("radio", { name: "休日窓口" }) as HTMLInputElement)
        .checked,
    ).toBe(true);
    expect(view.queryByText("平日9時")).toBeNull();
    fireEvent.click(view.getByRole("radio", { name: "平日 施設名" }));
    expect(view.getByText("平日9時")).toBeTruthy();
    expect(view.queryByText("休日10時")).toBeNull();
    expect(
      view.getByRole("link", { name: "配布場所へ行く" }).getAttribute("href"),
    ).toContain("35%2C139");
    expect(
      view.getByRole("button", { name: "① 受け取る", current: "step" }),
    ).toBeTruthy();
    fireEvent.click(view.getByRole("button", { name: "② 蓋を訪ねる" }));
    expect(
      view.getByRole("button", { name: "② 蓋を訪ねる", current: "step" }),
    ).toBeTruthy();
    expect(view.getAllByRole("link", { name: /行く/ })).toHaveLength(1);
    expect(
      view.getByRole("link", { name: "蓋へ行く" }).getAttribute("href"),
    ).toContain("36%2C140");
    // Choosing where to receive the card returns to receiving it.
    fireEvent.click(view.getByRole("radio", { name: "休日窓口" }));
    expect(
      view.getByRole("link", { name: "配布場所へ行く" }).getAttribute("href"),
    ).toContain("37%2C141");
  },
);
it("starts at the lid only where the card cannot be received and no pin was tapped", () => {
  const ended = { ...card, status: "ended" as const };
  const view = setup(ended);
  expect(
    view.getByRole("button", { name: "② 蓋を訪ねる", current: "step" }),
  ).toBeTruthy();
  expect(view.getByRole("link", { name: "蓋へ行く" })).toBeTruthy();
  expect(view.getByText("配布は終了しています")).toBeTruthy();
  view.unmount();
  const tapped = setup(ended, data, "a");
  expect(
    tapped.getByRole("button", { name: "① 受け取る", current: "step" }),
  ).toBeTruthy();
  expect(tapped.getByRole("link", { name: "場所を見る" })).toBeTruthy();
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
    ["H3", "カード全体の配布時間（原文）"],
  ]);
  // No paragraph is drawn for a relation's empty free text.
  expect(
    [...view.container.querySelectorAll("p")].filter(
      (node) => !node.textContent,
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
        card={{ ...card, links: links && [...links], lid: { status: "none" } }}
        data={{
          ...data,
          places: [
            {
              ...data.places[0]!,
              name: "",
              address: "",
              coordinate: { status: "unconfirmed" },
            },
          ],
        }}
        catalog={null}
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
    places: [...data.places, { ...data.places[0]!, id: "b", name: "別施設" }],
    relations: [...data.relations, { ...data.relations[0]!, placeId: "b" }],
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
      <CardDetail
        card={card}
        data={twoPlaces}
        catalog={null}
        onExpand={expand}
      />
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

it.each(["map", "catalog"] as const)(
  "keeps one stamp for a paused multi-counter card in %s details",
  async (variant) => {
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
            card={{ ...card, status }}
            data={{
              ...data,
              places: [...data.places, { ...data.places[0]!, id: "b" }],
              relations: [
                ...data.relations,
                { ...data.relations[0]!, placeId: "b" },
              ],
            }}
            catalog={null}
            variant={variant}
          />
        </RecordsContext>,
      );
      expect(view.queryByRole("region", { name: "入手の記録" })).toBeNull();
      const stamps = view.getAllByRole("button", { name: "入手したら押す" });
      expect(stamps).toHaveLength(1);
      fireEvent.click(stamps[0]!);
      expect(save).toHaveBeenLastCalledWith(
        "test",
        expect.objectContaining({ cardId: "test", memo: null }),
      );
      view.unmount();
    }
    vi.unstubAllEnvs();
  },
);
