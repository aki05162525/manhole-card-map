import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createCardCatalog } from "../../domain/card-catalog";
import type { Data } from "../../domain/types";
import { searchSession } from "./map-search-state";
import { MapSearch, type MapSearchProps } from "./map-search";

beforeEach(() => {
  // jsdom does not implement the browser's modal dialog methods.
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function () {
    this.open = false;
  };
});
afterEach(cleanup);
const data: Data = {
  schema: 1,
  updated: "",
  places: [],
  relations: [],
  pins: [],
  cards: Array.from({ length: 8 }, (_, i) => ({
    id: `01-00${i}-A001`,
    pref: "北海道",
    city: `観光${i}`,
    series: "",
    issued: "",
    acquired: "",
    status: "active",
    lid: { status: "unconfirmed" },
    placeText: null,
    hours: null,
    links: null,
  })),
};
const catalog = createCardCatalog(data);

function mount(overrides: Partial<MapSearchProps> = {}) {
  const props = {
    catalog,
    onSelect: vi.fn(),
    pref: "13",
    session: searchSession({ phase: "search", query: "観光" }),
    ...overrides,
  };
  return { ...render(<MapSearch {...props} />), props };
}
it("renders nationwide native results including unpinned cards", () => {
  const { container } = mount();
  expect(screen.getAllByText(/配布施設ピンなし/)).toHaveLength(8);
  expect(screen.getAllByText("配布施設の登録なし")).toHaveLength(8);
  expect(screen.getByText("北海道・観光0")).toBeTruthy();
  expect(container.querySelector('a[href="/cards.html?pref=13"]')).toBeTruthy();
  expect(container.querySelector('[role="option"]')).toBeNull();
  expect(screen.queryByText("一覧で全件見る")).toBeNull();
});
it("resets pagination and scroll on query changes without a form submission", () => {
  const onUpdate = vi.fn();
  const { container } = mount({ onUpdate });
  const scroller = container.querySelector(".map-search-results")!;
  scroller.scrollTop = 80;
  fireEvent.change(screen.getByRole("searchbox"), {
    target: { value: "三島" },
  });
  expect(onUpdate).toHaveBeenCalledWith({
    query: "三島",
    limit: 50,
    scroll: 0,
    selected: null,
  });
  expect(scroller.scrollTop).toBe(0);
  expect(container.querySelector("form")).toBeNull();
  onUpdate.mockClear();
  fireEvent.scroll(scroller);
  expect(onUpdate).not.toHaveBeenCalled();
});
it("prevents DOM-only cancel and delegates closing to history", () => {
  const onClose = vi.fn();
  mount({ onClose });
  expect(
    fireEvent(
      screen.getByRole("dialog"),
      new Event("cancel", { cancelable: true }),
    ),
  ).toBe(false);
  expect(onClose).toHaveBeenCalledOnce();
});
it("reloads through the parent while keeping failed input editable", () => {
  const onReload = vi.fn();
  mount({ catalog: null, dataError: "取得失敗", onReload });
  fireEvent.click(screen.getByRole("button", { name: "再読み込み" }));
  expect(onReload).toHaveBeenCalledOnce();
  expect((screen.getByRole("searchbox") as HTMLInputElement).disabled).toBe(
    false,
  );
});
it("adds fifty results explicitly", () => {
  const large = createCardCatalog({
    ...data,
    cards: Array.from({ length: 58 }, (_, i) => ({
      ...data.cards[0],
      id: String(i),
    })),
  });
  const onUpdate = vi.fn();
  const { container, rerender, props } = mount({ catalog: large, onUpdate });
  expect(container.querySelectorAll("[data-card]")).toHaveLength(50);
  fireEvent.click(screen.getByText("さらに50件表示"));
  expect(onUpdate).toHaveBeenCalledWith({ limit: 100 });
  rerender(
    <MapSearch
      {...props}
      session={searchSession({ phase: "search", query: "観光", limit: 100 })}
    />,
  );
  expect(container.querySelectorAll("[data-card]")).toHaveLength(58);
});
it("focuses input on open, ignores IME Enter, and focuses heading on Enter", () => {
  const onSelect = vi.fn();
  mount({ onSelect });
  const input = screen.getByRole("searchbox");
  expect(document.activeElement).toBe(input);
  fireEvent.compositionStart(input);
  fireEvent.keyDown(input, { key: "Enter", isComposing: true });
  expect(document.activeElement).toBe(input);
  fireEvent.compositionEnd(input);
  fireEvent.keyDown(input, { key: "Enter" });
  expect(document.activeElement).toBe(
    screen.getByRole("heading", { name: "検索結果" }),
  );
  expect(onSelect).not.toHaveBeenCalled();
});
it("saves scroll and selection before passing an unpinned card to parent", () => {
  const onUpdate = vi.fn(),
    onSelect = vi.fn();
  const { container } = mount({ onUpdate, onSelect });
  container.querySelector(".map-search-results")!.scrollTop = 240;
  fireEvent.click(container.querySelector("[data-card]")!);
  expect(onUpdate).toHaveBeenCalledWith({
    selected: data.cards[0].id,
    restore: true,
    scroll: 240,
  });
  expect(onSelect).toHaveBeenCalledWith(data.cards[0]);
  expect(onUpdate.mock.invocationCallOrder[0]).toBeLessThan(
    onSelect.mock.invocationCallOrder[0],
  );
});
it("restores the selected row and scroll, then returns focus to the search bar", () => {
  const { container, rerender, props } = mount({
    session: searchSession({ phase: "map" }),
  });
  rerender(
    <MapSearch
      {...props}
      session={searchSession({
        phase: "search",
        query: "観光",
        restore: true,
        selected: data.cards[2].id,
        scroll: 240,
      })}
    />,
  );
  expect(document.activeElement).toBe(
    container.querySelector(`[data-card="${data.cards[2].id}"]`),
  );
  expect(container.querySelector(".map-search-results")!.scrollTop).toBe(240);
  rerender(<MapSearch {...props} />);
  expect(document.activeElement).toBe(
    screen.getByRole("button", { name: "カードを検索" }),
  );
});
it("offers query clearing from the bar only on the map", () => {
  const { container, rerender, props } = mount({
    session: searchSession({ phase: "map", query: "三島" }),
  });
  expect(container.querySelector(".map-search-clear")).toBeTruthy();
  rerender(
    <MapSearch
      {...props}
      session={searchSession({ phase: "detail", query: "三島" })}
    />,
  );
  expect(container.querySelector(".map-search-clear")).toBeNull();
});
it("keeps typed text while loading or failed and gives empty-result guidance", () => {
  const session = searchSession({ phase: "search", query: "存在しない" });
  const { rerender, props } = mount({ catalog: null, session });
  expect((screen.getByRole("searchbox") as HTMLInputElement).value).toBe(
    "存在しない",
  );
  expect(screen.getByText("カード情報を読み込み中です")).toBeTruthy();
  rerender(<MapSearch {...props} dataError="取得失敗" />);
  expect((screen.getByRole("searchbox") as HTMLInputElement).value).toBe(
    "存在しない",
  );
  expect(screen.getByText("再読み込み")).toBeTruthy();
  rerender(<MapSearch {...props} catalog={catalog} />);
  expect(
    screen.getByText(
      "該当するカードはありません。自治体名・施設名・カード番号を変えてお試しください。",
    ),
  ).toBeTruthy();
});
