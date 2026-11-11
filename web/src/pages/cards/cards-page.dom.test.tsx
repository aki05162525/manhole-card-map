import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { createCardCatalog } from "../../domain/card-catalog";
import {
  embedCatalogSummary,
  readCatalogSummary,
  summarizeCatalog,
} from "../../domain/catalog-summary";
import type { Data } from "../../domain/types";
import { fixtureData } from "../../../scripts/fixtures";
import { CardsPage } from "./cards-page";

const data: Data = {
  schema: 1,
  updated: "",
  evaluatedAt: "2026-11-06",
  cards: Array.from({ length: 52 }, (_, index) => ({
    id: `test-${String(index).padStart(3, "0")}`,
    city: index === 51 ? "別の市" : "検索市",
    pref: index === 51 ? "東京都" : "北海道",
    series: "",
    issued: "",
    acquired: "",
    status: index === 0 ? "ended" : "unknown",
    lid: { status: "unconfirmed" },
    placeText: null,
    hours: null,
    links: null,
  })),
  places: [
    {
      id: "facility",
      name: "試験施設",
      address: "試験住所",
      phone: "",
      coordinate: { status: "confirmed", lat: 43, lng: 141 },
    },
  ],
  relations: [
    {
      cardId: "test-001",
      placeId: "facility",
      condition: "",
      periodRaw: "",
      alternativeRaw: "",
      review: "verified",
    },
  ],
  pins: [
    {
      id: "facility",
      cardIds: ["test-001"],
      kind: "place",
      pref: "北海道",
      status: "unknown",
      lat: 43,
      lng: 141,
    },
  ],
};
vi.mock("../../domain/card-catalog", { spy: true });
// `waiting` holds the data back until `arrive()`, as the network does.
const loading = vi.hoisted(() => ({ waiting: false, arrive: () => {} }));
vi.mock("../../features/card-data/use-catalog-data", async () => {
  const { useState } = await import("react");
  return {
    useCatalogData: () => {
      const [ready, setReady] = useState(!loading.waiting);
      loading.arrive = () => setReady(true);
      return {
        data: ready ? data : null,
        error: "",
        fixture: false,
        reload() {},
      };
    },
  };
});
beforeEach(() => {
  window.history.replaceState({ owner: "preserved" }, "", "/cards.html");
  vi.clearAllMocks();
  loading.waiting = false;
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  document.cookie = "signed_in=; Max-Age=0; Path=/";
});
async function traverse(direction: "back" | "forward", search: string) {
  window.history[direction]();
  await waitFor(() => expect(window.location.search).toBe(search));
}
function results() {
  return within(screen.getByRole("region", { name: /枚/ }));
}
/** What the built cards.html hands the entry. */
function builtSummary(source: Data) {
  const root = document.createElement("div");
  root.innerHTML = embedCatalogSummary(
    "<div data-catalog-summary></div>",
    summarizeCatalog(source),
  );
  return readCatalogSummary((root.firstElementChild as HTMLElement).dataset);
}
function arrive() {
  act(() => loading.arrive());
}
/** The logo and skeleton that stand in for the results. */
function loadingStatus() {
  return (
    screen.queryByText("カード情報を読み込み中…")?.closest('[role="status"]')
      ?.textContent ?? null
  );
}

it("counts the build's summary as the catalog counts the same data", () => {
  const source: Data = {
    ...fixtureData,
    evaluatedAt: "2026-11-06",
    cards: [
      ...fixtureData.cards,
      { ...fixtureData.cards[0], id: "x", pref: "" },
    ],
  };
  const catalog = createCardCatalog(source);
  loading.waiting = true;
  render(<CardsPage summary={builtSummary(source)} />);
  const shown = Object.fromEntries(
    [...document.querySelectorAll<HTMLElement>("[data-pref]")].map((button) => [
      button.dataset.pref,
      Number(button.querySelector("span")!.textContent!.replace("枚", "")),
    ]),
  );
  expect(shown).toEqual(
    Object.fromEntries(
      [...catalog.prefectures, catalog.other].map((pref) => [
        pref.code,
        pref.total,
      ]),
    ),
  );
  expect(document.querySelector(".catalog-intro p")?.textContent).toBe(
    `${catalog.total}枚・${source.evaluatedAt}時点`,
  );
});

it("shows the first view from the build's summary and keeps it when the data arrives", () => {
  loading.waiting = true;
  const { container } = render(<CardsPage summary={builtSummary(data)} />);
  expect(screen.queryByText(/読み込み中/)).toBeNull();
  expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
    "マンホールカード一覧",
  );
  expect(document.querySelector(".catalog-intro p")?.textContent).toBe(
    "52枚・2026-11-06時点",
  );
  expect(screen.getByRole("button", { name: /北海道.*51.*枚/ })).toBeTruthy();
  expect(screen.getByRole("button", { name: /東京都.*1.*枚/ })).toBeTruthy();
  expect(screen.getByRole("searchbox")).toBeTruthy();
  const before = container.innerHTML;
  arrive();
  expect(container.innerHTML).toBe(before);
});

it("acts on a prefecture or a search before the data arrives and fills the results after", async () => {
  loading.waiting = true;
  render(<CardsPage summary={builtSummary(data)} />);
  fireEvent.click(screen.getByRole("button", { name: /北海道.*51.*枚/ }));
  expect(window.location.search).toBe("?pref=01");
  expect(screen.getByRole("combobox")).toHaveProperty("value", "01");
  expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
    "北海道51枚",
  );
  expect(loadingStatus()).toContain("カード情報を読み込み中…");
  expect(screen.queryByRole("region", { name: "地域から選ぶ" })).toBeNull();
  await traverse("back", "");
  await waitFor(() =>
    expect(screen.getByRole("region", { name: "地域から選ぶ" })).toBeTruthy(),
  );
  expect(loadingStatus()).toBeNull();
  fireEvent.change(screen.getByRole("searchbox"), {
    target: { value: "検索市" },
  });
  fireEvent.submit(screen.getByRole("search"));
  expect(window.location.search).toBe(`?q=${encodeURIComponent("検索市")}`);
  expect(loadingStatus()).toContain("カード情報を読み込み中…");
  expect(screen.queryByRole("article")).toBeNull();
  arrive();
  expect(loadingStatus()).toBeNull();
  expect(results().getAllByRole("article")).toHaveLength(50);
  expect(screen.getByRole("searchbox")).toHaveProperty("value", "検索市");
});

it("opens a filtered URL with the loading results until the data arrives", () => {
  window.history.replaceState({}, "", "/cards.html?card=test-001");
  loading.waiting = true;
  render(<CardsPage summary={builtSummary(data)} />);
  expect(loadingStatus()).toContain("カード情報を読み込み中…");
  expect(screen.queryByRole("region", { name: "test-001" })).toBeNull();
  arrive();
  expect(loadingStatus()).toBeNull();
  const detail = screen.getByRole("region", { name: "検索市" });
  expect(document.activeElement).toBe(
    within(detail).getByRole("heading", { level: 2 }),
  );
});

it("leaves Japanese input to the keyboard's defaults", () => {
  render(<CardsPage />);
  // iOS can lose Japanese conversion when these are switched off.
  for (const name of ["autocorrect", "spellcheck", "autocapitalize"])
    expect(screen.getByRole("searchbox").hasAttribute(name)).toBe(false);
  // Safari AutoFill reads 「カード番号」 as a credit card number and locks the
  // keyboard to Latin letters.
  expect(screen.getByRole("searchbox").getAttribute("autocomplete")).toBe(
    "off",
  );
  expect(screen.getByLabelText(/自治体・施設・番号/)).toBe(
    screen.getByRole("searchbox"),
  );
  expect(document.body.textContent).not.toContain("カード番号");
});
it("keeps prefecture, submitted search and pagination in history through back and forward", async () => {
  render(<CardsPage />);
  expect(screen.queryByRole("article")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: /北海道.*51.*枚/ }));
  expect(window.location.search).toBe("?pref=01");
  expect(screen.getByRole("combobox")).toHaveProperty("value", "01");
  fireEvent.change(screen.getByRole("searchbox"), {
    target: { value: " 検索市 " },
  });
  expect(window.location.search).toBe("?pref=01");
  fireEvent.submit(screen.getByRole("search"));
  const searched = `?pref=01&q=${encodeURIComponent("検索市")}`;
  expect(window.location.search).toBe(searched);
  fireEvent.click(screen.getByRole("button", { name: "次へ" }));
  expect(window.location.search).toBe(`${searched}&page=2`);
  expect(results().getAllByRole("article")).toHaveLength(1);
  expect(document.querySelector(".catalog-intro-pref p")?.textContent).toBe(
    "ピンあり1・なし50 · 2026-11-06時点",
  );
  expect(document.activeElement).toBe(
    results().getByRole("heading", { level: 2 }),
  );
  await traverse("back", searched);
  await waitFor(() =>
    expect(results().getAllByRole("article")).toHaveLength(50),
  );
  await traverse("back", "?pref=01");
  await waitFor(() =>
    expect(screen.getByRole("searchbox")).toHaveProperty("value", ""),
  );
  await traverse("back", "");
  await waitFor(() => expect(screen.queryByRole("combobox")).toBeNull());
  expect(screen.queryByRole("article")).toBeNull();
  await traverse("forward", "?pref=01");
  await waitFor(() =>
    expect(screen.getByRole("combobox")).toHaveProperty("value", "01"),
  );
  expect(window.history.state.owner).toBe("preserved");
});

it("focuses detail and restores the originating row when closing, including null source fields", async () => {
  window.history.replaceState(
    { owner: "preserved" },
    "",
    "/cards.html?q=検索市",
  );
  render(<CardsPage />);
  const row = screen.getByRole("link", {
    name: /検索市 test-000/,
  });
  row.focus();
  fireEvent.click(row);
  expect(window.location.search).toBe(
    "?q=%E6%A4%9C%E7%B4%A2%E5%B8%82&card=test-000",
  );
  const detail = screen.getByRole("region", { name: "検索市" });
  expect(document.activeElement).toBe(
    within(detail).getByRole("heading", { level: 2 }),
  );
  for (const text of [
    "原文リンクの記載なし",
    "配布時間の記載なし",
    "配布は終了しています",
  ])
    expect(within(detail).getByText(text, { exact: false })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "詳細を閉じる" }));
  await waitFor(() => expect(document.activeElement).toBe(row));
  expect(window.location.search).toBe("?q=%E6%A4%9C%E7%B4%A2%E5%B8%82");
  await traverse("forward", "?q=%E6%A4%9C%E7%B4%A2%E5%B8%82&card=test-000");
  await waitFor(() =>
    expect(document.activeElement?.id).toBe("catalog-detail-title"),
  );
});

it("closes a direct detail URL with replace and falls back to the results heading", () => {
  window.history.replaceState(
    { owner: "direct" },
    "",
    "/cards.html?card=test-000",
  );
  const back = vi.spyOn(window.history, "back");
  render(<CardsPage />);
  fireEvent.click(screen.getByRole("button", { name: "詳細を閉じる" }));
  expect(back).not.toHaveBeenCalled();
  expect(window.location.search).toBe("");
  expect(window.history.state.owner).toBe("direct");
  expect(document.activeElement?.id).toBe("catalog-regions-title");
});

it("builds the catalog once, reusing it across detail renders", () => {
  window.history.replaceState(
    { owner: "preserved" },
    "",
    "/cards.html?q=検索市",
  );
  render(<CardsPage />);
  expect(createCardCatalog).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole("link", { name: /検索市 test-000/ }));
  expect(createCardCatalog).toHaveBeenCalledTimes(1);
  fireEvent.change(screen.getByRole("searchbox"), {
    target: { value: "draft" },
  });
  expect(createCardCatalog).toHaveBeenCalledTimes(1);
});

it("does not rebuild IDs, recount pins or render rows when only draft input changes", () => {
  window.history.replaceState(
    { owner: "preserved" },
    "",
    "/cards.html?q=検索市",
  );
  render(<CardsPage />);
  const catalog = vi.mocked(createCardCatalog).mock.results[0].value;
  const keys = vi.spyOn(catalog.cardsById, "keys");
  const entries = vi.spyOn(catalog.entriesById, "get");
  fireEvent.change(screen.getByRole("searchbox"), {
    target: { value: "draft" },
  });
  expect(keys).not.toHaveBeenCalled();
  expect(entries).not.toHaveBeenCalled();
  expect(results().getAllByRole("article")).toHaveLength(50);
});

it("removes full-width edition suffixes from catalog row titles and action labels", () => {
  const previous = data.cards[0].city;
  data.cards[0].city = "東京23区 （A001）";
  try {
    window.history.replaceState(
      { owner: "preserved" },
      "",
      "/cards.html?pref=01",
    );
    render(<CardsPage />);
    expect(
      results().getByRole("heading", { name: "東京23区 test-000", level: 3 }),
    ).toBeTruthy();
    expect(
      results().getByRole("link", { name: /東京23区 test-000/ }),
    ).toBeTruthy();
    expect(results().queryByText(/（A001）/)).toBeNull();
  } finally {
    data.cards[0].city = previous;
  }
});

it("marks the current document and shows compact prefecture information", () => {
  window.history.replaceState({}, "", "/cards.html?pref=01");
  render(<CardsPage />);
  expect(
    screen.getByRole("link", { name: "一覧" }).getAttribute("aria-current"),
  ).toBe("page");
  expect(
    screen.getByRole("link", { name: "地図" }).hasAttribute("aria-current"),
  ).toBe(false);
  // Catalog headings keep the prefecture name before the card count.
  expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
    "北海道51枚",
  );
  expect(screen.queryByText("カード一覧")).toBeNull();
  expect(
    document.querySelector(".catalog-intro-pref .catalog-date")?.textContent,
  ).toBe("2026-11-06時点");
  expect(
    screen.getByRole("navigation", { name: "一覧のページ送り" }).textContent,
  ).toBe("前へ1–50枚 / 51枚次へ");
});
it("uses a single navigation link per row and leaves independent buttons operable", () => {
  window.history.replaceState(
    { owner: "preserved" },
    "",
    "/cards.html?q=検索市",
  );
  render(<CardsPage />);
  const article = results().getAllByRole("article")[0];
  const link = within(article).getByRole("link");
  expect(link.getAttribute("href")).toBe(
    "/cards.html?q=%E6%A4%9C%E7%B4%A2%E5%B8%82&card=test-000",
  );
  const button = document.createElement("button");
  button.textContent = "独立した操作";
  article.append(button);
  fireEvent.click(button);
  expect(window.location.search).toBe("?q=%E6%A4%9C%E7%B4%A2%E5%B8%82");
  expect(article.querySelectorAll("a")).toHaveLength(1);
  fireEvent.click(link, { ctrlKey: true });
  expect(window.location.search).toBe("?q=%E6%A4%9C%E7%B4%A2%E5%B8%82");
});
it("shares the search empty state and links back to regions", () => {
  window.history.replaceState({}, "", "/cards.html?q=見つからない語");
  const { container } = render(<CardsPage />);
  expect(screen.queryByRole("region", { name: "地域から選ぶ" })).toBeNull();
  expect(container.querySelector(".search-empty-art")).toBeTruthy();
  expect(container.querySelector(".search-empty-state")).toBeTruthy();
  expect(
    screen.getByRole("link", { name: "地域から探す" }).getAttribute("href"),
  ).toBe("/cards.html");
});

it.each(["", "&pref=01"])(
  "announces an empty search only once without zero counts: %s",
  (pref) => {
    window.history.replaceState({}, "", `/cards.html?q=該当なし${pref}`);
    const { container } = render(<CardsPage />);
    expect(
      screen.getAllByRole("heading", {
        name: "『該当なし』に一致するカードはありません",
      }),
    ).toHaveLength(1);
    expect(
      container.querySelector(".catalog-results")!.textContent,
    ).not.toMatch(/0枚|ピンあり0|なし0|検索結果|基準日|2026-11-06/);
    expect(container.querySelector(".catalog-intro")!.textContent).not.toMatch(
      /0枚|ピンあり0|なし0/,
    );
    expect(
      screen.getByText("漢字の自治体名・施設名・県名・番号の一部で探せます"),
    ).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "地域から探す" }).getAttribute("href"),
    ).toBe("/cards.html");
  },
);
it("omits municipality and prefecture only from the catalog detail prelude", () => {
  window.history.replaceState({}, "", "/cards.html?card=test-001");
  const { container } = render(<CardsPage />);
  expect(container.querySelector(".detail-prelude")!.textContent).toBe(
    "test-001 · ",
  );
  expect(container.querySelector(".detail-prelude")!.textContent).not.toMatch(
    /検索市|北海道/,
  );
});

it("uses explicit catalog pin labels for mapped and unmapped facilities", () => {
  window.history.replaceState(
    { owner: "preserved" },
    "",
    "/cards.html?q=検索市",
  );
  render(<CardsPage />);
  expect(results().getByText("地図にピンあり")).toBeTruthy();
  expect(results().getAllByText("ピンなし・配布場所未登録")).toHaveLength(49);
});

it("shows regions only until a prefecture or submitted query is chosen", async () => {
  render(<CardsPage />);
  expect(screen.getByRole("region", { name: "地域から選ぶ" })).toBeTruthy();
  expect(screen.queryByRole("article")).toBeNull();
  expect(
    screen.queryByRole("navigation", { name: "一覧のページ送り" }),
  ).toBeNull();
  fireEvent.change(screen.getByRole("searchbox"), {
    target: { value: "検索市" },
  });
  expect(screen.queryByRole("article")).toBeNull();
  fireEvent.submit(screen.getByRole("search"));
  expect(results().getAllByRole("article")).toHaveLength(50);
  await traverse("back", "");
  expect(screen.queryByRole("article")).toBeNull();
});

it("links the selected prefecture heading to its static page even for empty results", () => {
  window.history.replaceState({}, "", "/cards.html?pref=01&q=該当なし");
  const { container } = render(<CardsPage />);
  const intro = within(
    container.querySelector(".catalog-intro") as HTMLElement,
  );
  expect(
    intro.getAllByRole("link", { name: "北海道の配布場所一覧ページ" }),
  ).toHaveLength(1);
  expect(intro.getByRole("link").getAttribute("href")).toBe("/pref/hokkaido/");
});
it("links catalog details to a card page", () => {
  window.history.replaceState({}, "", "/cards.html?card=test-001");
  render(<CardsPage />);
  expect(
    screen
      .getByRole("link", { name: "このカードのページ" })
      .getAttribute("href"),
  ).toBe("/card/test-001/");
});

it("filters cards without coordinates and permits recording from catalog details", async () => {
  vi.stubEnv("VITE_ACCOUNTS_ENABLED", "true");
  document.cookie = "signed_in=1; Path=/";
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "/api/me/records")
        return new Response('[{"cardId":"test-000","receivedOn":null}]');
      if (init?.method === "DELETE") return new Response(null, { status: 204 });
      return new Response(
        '{"cardId":"test-000","receivedOn":null,"memo":null}',
      );
    }),
  );
  render(<CardsPage />);
  fireEvent.click(await screen.findByRole("radio", { name: "回収済み" }));
  expect(screen.getAllByRole("article")).toHaveLength(1);
  expect(screen.getByText("test-000 · 弾の記載なし")).toBeTruthy();
  expect(screen.getByText("ピンなし・配布場所未登録")).toBeTruthy();
  fireEvent.click(screen.getByRole("link", { name: "検索市 test-000" }));
  fireEvent.click(await screen.findByRole("button", { name: "未回収に戻す" }));
  await screen.findByText("未回収に戻しました");
  expect(screen.queryByRole("article")).toBeNull();
  // Beside the status and in the record panel.
  expect(screen.getAllByRole("button", { name: "回収した" })).toHaveLength(2);
});

it("starts at page one when a receipt filter replaces a paginated catalog", async () => {
  vi.stubEnv("VITE_ACCOUNTS_ENABLED", "true");
  document.cookie = "signed_in=1; Path=/";
  history.replaceState(null, "", "/cards.html?pref=01&page=2");
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () => new Response('[{"cardId":"test-000","receivedOn":null}]'),
    ),
  );
  render(<CardsPage />);
  fireEvent.click(await screen.findByRole("radio", { name: "回収済み" }));
  expect(location.search).toBe("?pref=01");
  expect(screen.getAllByRole("article")).toHaveLength(1);
  expect(screen.queryByRole("alert")).toBeNull();
});

it("asks for the records only once the data has arrived, as before", async () => {
  vi.stubEnv("VITE_ACCOUNTS_ENABLED", "true");
  document.cookie = "signed_in=1; Path=/";
  const fetched = vi.fn(
    async () => new Response('[{"cardId":"test-000","receivedOn":null}]'),
  );
  vi.stubGlobal("fetch", fetched);
  loading.waiting = true;
  render(<CardsPage summary={builtSummary(data)} />);
  expect(
    await screen.findByRole("button", { name: /北海道.*51.*枚/ }),
  ).toBeTruthy();
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(fetched).not.toHaveBeenCalled();
  arrive();
  fireEvent.click(await screen.findByRole("radio", { name: "回収済み" }));
  expect(screen.getAllByRole("article")).toHaveLength(1);
  expect(fetched).toHaveBeenCalledTimes(1);
});
