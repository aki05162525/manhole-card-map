import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
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
  expect(screen.getAllByText("ピンなし・配布場所未登録")).toHaveLength(8);
  expect(screen.getAllByText("配布場所の登録なし")).toHaveLength(8);
  expect(
    screen.getAllByText("北海道", { selector: ".search-pref" }),
  ).toHaveLength(8);
  expect(container.querySelector('[role="option"]')).toBeNull();
  expect(screen.queryByText("一覧で全件見る")).toBeNull();
});
it("keeps the list and account out of the bar and offers them from the menu", () => {
  vi.stubEnv("VITE_ACCOUNTS_ENABLED", "true");
  const { container } = mount({ session: searchSession() });
  const bar = container.querySelector<HTMLElement>(".map-search-bar")!;
  expect(
    within(bar)
      .getAllByRole("link")
      .map((link) => link.getAttribute("href")),
  ).toEqual(["/about"]);
  const menu = within(bar).getByRole("button", { name: "メニュー" });
  expect(bar.lastElementChild!.contains(menu)).toBe(true);
  fireEvent.click(menu);
  const nav = within(
    within(bar).getByRole("navigation", { name: "メインナビゲーション" }),
  );
  expect(
    nav.getAllByRole("link").map((link) => link.getAttribute("href")),
  ).toEqual(["/", "/cards?pref=13", "/friends", "/account", "/about"]);
  expect(
    nav.getByRole("link", { name: "地図" }).getAttribute("aria-current"),
  ).toBe("page");
  vi.unstubAllEnvs();
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
  fireEvent.click(screen.getByText("さらに8件表示"));
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
it("keeps focus for Safari's confirming Enter after compositionend", () => {
  mount();
  const input = screen.getByRole("searchbox");
  fireEvent.compositionStart(input);
  fireEvent.compositionEnd(input);
  const confirmingEnter = new KeyboardEvent("keydown", {
    key: "Enter",
    keyCode: 229,
    isComposing: false,
    bubbles: true,
    cancelable: true,
  });
  fireEvent(input, confirmingEnter);
  expect(document.activeElement).toBe(input);
  expect(confirmingEnter.defaultPrevented).toBe(false);
  fireEvent.keyDown(input, { key: "Enter", keyCode: 13 });
  expect(document.activeElement).toBe(
    screen.getByRole("heading", { name: "検索結果" }),
  );
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
  expect(screen.getByText("読み込み中")).toBeTruthy();
  rerender(<MapSearch {...props} dataError="取得失敗" />);
  expect((screen.getByRole("searchbox") as HTMLInputElement).value).toBe(
    "存在しない",
  );
  expect(screen.getByText("再読み込み")).toBeTruthy();
  rerender(<MapSearch {...props} catalog={catalog} />);
  expect(
    screen.getByText("『存在しない』に一致するカードはありません"),
  ).toBeTruthy();
});

it("shows one concise count and only uses the truncated-count wording when needed", () => {
  const { rerender, props } = mount();
  expect(screen.getAllByText("8件")).toHaveLength(1);
  expect(screen.getByRole("status").textContent).toBe("8件");
  rerender(
    <MapSearch
      {...props}
      session={searchSession({ phase: "search", query: "観光", limit: 5 })}
    />,
  );
  expect(screen.getAllByText("5件を表示中 · 全8件")).toHaveLength(1);
  expect(screen.queryByText("8件")).toBeNull();
});
it("renders three decorative loading rules and a single status, then actionable empty guidance", () => {
  const session = searchSession({ phase: "search", query: "該当なし" });
  const { container, props, rerender } = mount({ catalog: null, session });
  expect(screen.getAllByRole("status")).toHaveLength(1);
  expect(screen.getAllByText("読み込み中")).toHaveLength(1);
  expect(
    container.querySelectorAll('.search-skeleton[aria-hidden="true"] > span'),
  ).toHaveLength(3);
  rerender(<MapSearch {...props} catalog={catalog} />);
  expect(container.querySelector(".search-skeleton")).toBeNull();
  expect(
    container.querySelector('.search-empty-state svg[aria-hidden="true"]'),
  ).toBeTruthy();
  expect(
    screen.getByText("『該当なし』に一致するカードはありません"),
  ).toBeTruthy();
  expect(
    screen.getByText("漢字の自治体名・施設名・県名・番号の一部で探せます"),
  ).toBeTruthy();
  expect(
    screen.getByRole("link", { name: "地域から探す" }).getAttribute("href"),
  ).toBe("/cards?pref=13");
});
it("marks only matching municipality, prefecture, number and facility text, escaping search syntax", () => {
  const highlighted = createCardCatalog({
    ...data,
    cards: [{ ...data.cards[0], city: "北海.観光", id: "北海.001" }],
    places: [
      {
        id: "p",
        name: "北海.案内所",
        address: "",
        phone: "",
        coordinate: { status: "unconfirmed" },
      },
    ],
    relations: [
      {
        cardId: "北海.001",
        placeId: "p",
        review: "verified",
        condition: "",
        periodRaw: "",
        alternativeRaw: "",
      },
    ],
  });
  const { container, props, rerender } = mount({
    catalog: highlighted,
    session: searchSession({ phase: "search", query: "北海" }),
  });
  expect(
    [...container.querySelectorAll("mark")].map((node) => node.textContent),
  ).toEqual(["北海", "北海", "北海", "北海"]);
  expect(container.querySelector(".status-chip mark")).toBeNull();
  rerender(
    <MapSearch
      {...props}
      session={searchSession({ phase: "search", query: "." })}
    />,
  );
  expect(
    [...container.querySelectorAll("mark")].map((node) => node.textContent),
  ).toEqual([".", ".", "."]);
  expect(container.querySelector(".search-facility")?.textContent).toBe(
    "北海.案内所",
  );
});
it("switches panel/fullscreen classes on the 1001px media query without replacing the modal", () => {
  let update: () => void = () => {};
  const media = {
    matches: false,
    addEventListener: vi.fn((_, listener) => {
      update = listener;
    }),
    removeEventListener: vi.fn(),
  };
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => media),
  );
  const { container } = mount();
  const dialog = screen.getByRole("dialog");
  expect(dialog.classList.contains("map-search-fullscreen")).toBe(true);
  media.matches = true;
  fireEvent(window, new Event("resize"));
  act(() => update());
  expect(dialog.classList.contains("map-search-panel")).toBe(true);
  expect(dialog.classList.contains("map-search-fullscreen")).toBe(false);
  expect(container.querySelector("dialog")).toBe(dialog);
  expect((dialog as HTMLDialogElement).open).toBe(true);
  cleanup();
  expect(media.removeEventListener).toHaveBeenCalled();
  vi.unstubAllGlobals();
});
it("routes fallback backdrop dismissal through history and ignores drags from inside", () => {
  const onClose = vi.fn();
  mount({ onClose });
  const dialog = screen.getByRole("dialog");
  vi.spyOn(dialog, "getBoundingClientRect").mockReturnValue({
    left: 16,
    right: 436,
    top: 16,
    bottom: 400,
  } as DOMRect);
  // jsdom has no PointerEvent; MouseEvent supplies the pointer coordinates.
  fireEvent(
    dialog,
    new MouseEvent("pointerdown", { bubbles: true, clientX: 30, clientY: 30 }),
  );
  fireEvent(
    dialog,
    new MouseEvent("pointerup", { bubbles: true, clientX: 500, clientY: 30 }),
  );
  expect(onClose).not.toHaveBeenCalled();
  fireEvent(
    dialog,
    new MouseEvent("pointerdown", { bubbles: true, clientX: 500, clientY: 30 }),
  );
  fireEvent(
    dialog,
    new MouseEvent("pointerup", { bubbles: true, clientX: 500, clientY: 30 }),
  );
  expect(onClose).toHaveBeenCalledOnce();
});

it("waits for finite dialog exit transitions and cancels a pending close when reopened", async () => {
  const { props, rerender } = mount();
  const dialog = screen.getByRole("dialog") as HTMLDialogElement;
  let finish = () => {};
  const finished = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const animations = vi.fn(() => [{ finished }]);
  Object.defineProperty(dialog, "getAnimations", {
    configurable: true,
    value: animations,
  });
  rerender(
    <MapSearch
      {...props}
      session={searchSession({ phase: "map", query: "観光" })}
    />,
  );
  expect(dialog.hasAttribute("data-closing")).toBe(true);
  expect(dialog.open).toBe(true);
  expect(animations).toHaveBeenCalledWith();
  rerender(<MapSearch {...props} />);
  expect(dialog.hasAttribute("data-closing")).toBe(false);
  await act(async () => {
    finish();
    await finished;
  });
  expect(dialog.open).toBe(true);
  rerender(
    <MapSearch
      {...props}
      session={searchSession({ phase: "map", query: "観光" })}
    />,
  );
  await act(async () => {
    await finished;
  });
  expect(dialog.open).toBe(false);
  expect(document.activeElement).toBe(
    screen.getByRole("button", { name: "カードを検索" }),
  );
});

it("shows and marks the hidden address that caused a destination-only match", () => {
  const catalog = createCardCatalog({
    ...data,
    cards: [{ ...data.cards[0], city: "出雲崎町" }],
    places: [
      {
        id: "p",
        name: "案内所",
        address: "新潟県三島郡出雲崎町",
        phone: "",
        coordinate: { status: "unconfirmed" },
      },
    ],
    relations: [
      {
        cardId: data.cards[0].id,
        placeId: "p",
        condition: "",
        periodRaw: "",
        alternativeRaw: "",
      },
    ],
  });
  const { container } = mount({
    catalog,
    session: searchSession({ phase: "search", query: "三島" }),
  });
  expect(container.querySelector(".search-facility")?.textContent).toBe(
    "新潟県三島郡出雲崎町",
  );
  expect(container.querySelector(".search-facility mark")?.textContent).toBe(
    "三島",
  );
});
it("cleans edition codes from result municipalities and marks exact rows", () => {
  const catalog = createCardCatalog({
    ...data,
    cards: [{ ...data.cards[0], city: "東京23区 （A001）" }],
  });
  const { container } = mount({
    catalog,
    session: searchSession({ phase: "search", query: "東京23区" }),
  });
  expect(
    container.querySelector(".search-municipality strong")?.textContent,
  ).toBe("東京23区");
  expect(
    container
      .querySelector("[data-card]")
      ?.classList.contains("search-row-exact"),
  ).toBe(true);
});
it("offers a query chip and consistent region link before input", () => {
  const onUpdate = vi.fn();
  mount({ onUpdate, session: searchSession({ phase: "search" }) });
  expect(screen.getByRole("heading", { name: "探し方" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "例: 三島" }));
  expect(onUpdate).toHaveBeenCalledWith({
    query: "三島",
    limit: 50,
    scroll: 0,
    selected: null,
  });
  expect(document.activeElement).toBe(screen.getByRole("searchbox"));
  expect(screen.getByRole("link", { name: "地域から探す" })).toBeTruthy();
});
it("announces empty results once, as one heading with no count or generic result heading", () => {
  mount({ session: searchSession({ phase: "search", query: "該当なし" }) });
  expect(
    screen.getByRole("heading", {
      name: "『該当なし』に一致するカードはありません",
    }),
  ).toBeTruthy();
  expect(
    screen.getAllByText("『該当なし』に一致するカードはありません"),
  ).toHaveLength(1);
  expect(screen.queryByText("0件")).toBeNull();
  expect(screen.queryByRole("heading", { name: "検索結果" })).toBeNull();
  expect(screen.getAllByRole("status")).toHaveLength(1);
  expect(screen.getByRole("status").textContent).toBe(
    "『該当なし』に一致するカードはありません",
  );
});
it("explains matches in additional facility names rather than only the summary", () => {
  const catalog = createCardCatalog({
    ...data,
    cards: [data.cards[0]],
    places: ["本館", "三島案内所"].map((name, i) => ({
      id: String(i),
      name,
      address: "",
      phone: "",
      coordinate: { status: "unconfirmed" },
    })),
    relations: [0, 1].map((i) => ({
      cardId: data.cards[0].id,
      placeId: String(i),
      condition: "",
      periodRaw: "",
      alternativeRaw: "",
    })),
  });
  const { container } = mount({
    catalog,
    session: searchSession({ phase: "search", query: "三島" }),
  });
  expect(container.querySelector(".search-facility")?.textContent).toBe(
    "三島案内所",
  );
  expect(container.querySelector(".search-facility mark")?.textContent).toBe(
    "三島",
  );
  expect(container.querySelector(".search-row-exact")).toBeNull();
});
