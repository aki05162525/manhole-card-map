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
it.each(["map", "catalog"] as const)(
  "selects counters and route in %s",
  (variant) => {
    const d: Data = {
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
    const view = render(
      <CardDetail
        card={card}
        data={d}
        catalog={null}
        variant={variant}
        selectedPinId="b"
      />,
    );
    expect(
      view.getByRole("button", { name: "休日窓口", pressed: true }),
    ).toBeTruthy();
    expect(view.queryByText("平日9時")).toBeNull();
    fireEvent.click(view.getByRole("button", { name: "平日 · 施設名" }));
    expect(view.getByText("平日9時")).toBeTruthy();
    expect(view.queryByText("休日10時")).toBeNull();
    expect(
      view.getByRole("link", { name: "配布場所へ行く" }).getAttribute("href"),
    ).toContain("35%2C139");
    fireEvent.click(view.getByRole("button", { name: "② 蓋を訪ねる" }));
    expect(
      view.getByRole("link", { name: "蓋へ行く" }).getAttribute("href"),
    ).toContain("36%2C140");
    fireEvent.click(view.getByRole("button", { name: "① 受け取る" }));
    expect(view.getByRole("link", { name: "配布場所へ行く" })).toBeTruthy();
    expect(view.queryByRole("button", { name: "詳しく" })).toBeNull();
  },
);
it("starts ended cards at the lid, and omits the second step without coordinates", () => {
  const view = setup({ ...card, status: "ended" });
  expect(
    view.getByRole("button", { name: "② 蓋を訪ねる", pressed: true }),
  ).toBeTruthy();
  expect(view.getByRole("link", { name: "蓋へ行く" })).toBeTruthy();
  expect(view.getByText("配布は終了しています")).toBeTruthy();
  view.unmount();
  const missing = setup({ ...card, lid: { status: "unconfirmed" } });
  expect(missing.queryByRole("button", { name: "② 蓋を訪ねる" })).toBeNull();
});
it("shows full hours without a continuation control", () => {
  const view = setup({ ...card, hours: ["平日9時", "休日10時"] });
  expect(view.container.querySelector(".distribution-hours")?.textContent).toBe(
    "平日9時\n休日10時",
  );
  expect(view.queryByText(/続きあり/)).toBeNull();
});

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
        summaryMode
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
