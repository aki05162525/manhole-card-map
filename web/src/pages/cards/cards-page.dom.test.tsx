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
import { prefecturePages } from "../../domain/prefecture-pages";
import type { Data } from "../../domain/types";
import { fixtureData } from "../../../scripts/build/fixtures";
import { replaceDocument } from "../../shared/browser/app-history";
import { ScreenActivity } from "../../shared/browser/screen-activity";
// As the app holds them: one host of the records above the screens.
import { RecordsHost } from "../../features/records/records-entry";
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
// jsdom cannot leave the document; the old-URL redirect is observed instead.
vi.mock("../../shared/browser/app-history", { spy: true });
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
  window.history.replaceState({ owner: "preserved" }, "", "/cards");
  vi.clearAllMocks();
  vi.mocked(replaceDocument).mockImplementation(() => {});
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

/** The count and the date written at the head of the page. */
const pageHead = () =>
  [".techo-count", ".catalog-intro .catalog-date"].map(
    (selector) => document.querySelector(selector)?.textContent,
  );
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
      Number(button.querySelector("span")!.textContent.replace("枚", "")),
    ]),
  );
  expect(shown).toEqual(
    Object.fromEntries(
      [...catalog.areas.flatMap((area) => area.prefectures), catalog.other].map(
        (pref) => [pref.code, pref.total],
      ),
    ),
  );
  expect(pageHead()).toEqual([
    `${catalog.total}枚`,
    `${source.evaluatedAt} 現在`,
  ]);
});

it("shows the first view from the build's summary and keeps it when the data arrives", () => {
  loading.waiting = true;
  const { container } = render(<CardsPage summary={builtSummary(data)} />);
  expect(screen.queryByText(/読み込み中/)).toBeNull();
  expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
    "マンホールカード一覧",
  );
  expect(pageHead()).toEqual(["52枚", "2026-11-06 現在"]);
  expect(screen.getByRole("button", { name: /北海道.*51.*枚/ })).toBeTruthy();
  expect(screen.getByRole("button", { name: /東京都.*1.*枚/ })).toBeTruthy();
  expect(screen.getByRole("searchbox").getAttribute("placeholder")).toBe(
    "自治体・施設・番号",
  );
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
  expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("北海道");
  expect(pageHead()[0]).toBe("51枚");
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
  window.history.replaceState({}, "", "/cards.html?pref=01&page=2");
  loading.waiting = true;
  render(<CardsPage summary={builtSummary(data)} />);
  expect(loadingStatus()).toContain("カード情報を読み込み中…");
  expect(screen.queryByRole("article")).toBeNull();
  arrive();
  expect(loadingStatus()).toBeNull();
  expect(results().getAllByRole("article")).toHaveLength(1);
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
it.each(["/cards", "/cards.html"])(
  "keeps prefecture, submitted search and pagination through history from %s",
  async (initialPath) => {
    window.history.replaceState({ owner: "preserved" }, "", initialPath);
    render(<CardsPage />);
    expect(screen.queryByRole("article")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /北海道.*51.*枚/ }));
    expect(window.location.search).toBe("?pref=01");
    expect(window.location.pathname).toBe("/cards");
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
    expect(pageHead()).toEqual(["51枚", "2026-11-06 現在"]);
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
    expect(window.location.pathname).toBe(initialPath);
    await traverse("forward", "?pref=01");
    expect(window.location.pathname).toBe("/cards");
    await waitFor(() =>
      expect(screen.getByRole("combobox")).toHaveProperty("value", "01"),
    );
    expect(window.history.state.owner).toBe("preserved");
  },
);

it("keeps prefecture, search and page through another screen's entries", async () => {
  const searched = `?pref=01&q=${encodeURIComponent("検索市")}&page=2`;
  window.history.replaceState({ owner: "preserved" }, "", `/cards${searched}`);
  render(<CardsPage />);
  const shown = () => {
    expect(screen.getByRole("combobox")).toHaveProperty("value", "01");
    expect(screen.getByRole("searchbox")).toHaveProperty("value", "検索市");
    expect(results().getAllByRole("article")).toHaveLength(1);
  };
  shown();
  const mapState = { mapFocus: { area: "kanto", pref: null } };
  act(() => {
    window.history.pushState(mapState, "", "/?card=test-000");
    window.dispatchEvent(new PopStateEvent("popstate", { state: mapState }));
  });
  shown();
  // The catalog is not the current screen, so its controls leave the entry alone.
  fireEvent.click(screen.getByRole("button", { name: "前へ" }));
  expect(window.location.pathname + window.location.search).toBe(
    "/?card=test-000",
  );
  expect(window.history.state).toEqual(mapState);
  shown();
  await traverse("back", searched);
  shown();
});
it("sends an old detail URL to the card's page in place of its entry, once the card is known", () => {
  window.history.replaceState({}, "", "/cards?pref=01&card=test-001");
  loading.waiting = true;
  render(<CardsPage summary={builtSummary(data)} />);
  // Unvalidated: the id may not be a card at all.
  expect(replaceDocument).not.toHaveBeenCalled();
  arrive();
  expect(vi.mocked(replaceDocument).mock.calls).toEqual([["/card/test-001/"]]);
  // Should the browser refuse, the same place is one link away.
  expect(
    within(screen.getByRole("status"))
      .getByRole("link", { name: "カードの案内ページ" })
      .getAttribute("href"),
  ).toBe("/card/test-001/");
  expect(document.querySelector(".card-detail-content")).toBeNull();
});

it("keeps an old detail URL of an unknown card on the list, with the way back", () => {
  window.history.replaceState({ owner: "direct" }, "", "/cards?card=missing");
  render(<CardsPage />);
  expect(replaceDocument).not.toHaveBeenCalled();
  expect(screen.getByRole("alert").textContent).toContain(
    "指定されたカードは見つかりません",
  );
  fireEvent.click(
    screen.getByRole("button", { name: "指定を修正して一覧へ戻る" }),
  );
  expect(window.location.pathname + window.location.search).toBe("/cards");
  expect(window.history.state.owner).toBe("direct");
  expect(screen.queryByRole("alert")).toBeNull();
  expect(screen.getByRole("region", { name: "地域から選ぶ" })).toBeTruthy();
});

it("leaves the location alone while the map is shown over an old detail URL, until the list returns", () => {
  window.history.replaceState({}, "", "/cards?card=test-001");
  loading.waiting = true;
  const page = (active: boolean) => (
    <ScreenActivity value={active}>
      <CardsPage summary={builtSummary(data)} />
    </ScreenActivity>
  );
  const { rerender } = render(page(true));
  // The same document moves to the map; the list stays mounted and hidden.
  const listEntry = window.history.state;
  window.history.pushState({}, "", "/?card=test-000");
  rerender(page(false));
  arrive();
  expect(replaceDocument).not.toHaveBeenCalled();
  // Shown again over the map's entry: still not the list's to replace.
  rerender(page(true));
  expect(replaceDocument).not.toHaveBeenCalled();
  rerender(page(false));
  window.history.pushState(listEntry, "", "/cards?card=test-001");
  rerender(page(true));
  expect(vi.mocked(replaceDocument).mock.calls).toEqual([["/card/test-001/"]]);
});

it("builds the catalog once, reusing it across draft input", () => {
  window.history.replaceState({ owner: "preserved" }, "", "/cards?q=検索市");
  render(<CardsPage />);
  expect(createCardCatalog).toHaveBeenCalledTimes(1);
  fireEvent.change(screen.getByRole("searchbox"), {
    target: { value: "draft" },
  });
  expect(createCardCatalog).toHaveBeenCalledTimes(1);
});

it("does not rebuild IDs, recount pins or render rows when only draft input changes", () => {
  window.history.replaceState({ owner: "preserved" }, "", "/cards?q=検索市");
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
    window.history.replaceState({ owner: "preserved" }, "", "/cards?pref=01");
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
  window.history.replaceState({}, "", "/cards?pref=01");
  render(<CardsPage />);
  expect(
    screen.getByRole("link", { name: "一覧" }).getAttribute("aria-current"),
  ).toBe("page");
  expect(
    screen.getByRole("link", { name: "地図" }).hasAttribute("aria-current"),
  ).toBe(false);
  // The page's head: its number, the prefecture's name, then the count.
  expect(document.querySelector(".techo-folio")?.textContent).toBe("No. 01");
  expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("北海道");
  expect(pageHead()[0]).toBe("51枚");
  expect(screen.queryByText("カード一覧")).toBeNull();
  expect(pageHead()[1]).toBe("2026-11-06 現在");
  expect(
    screen.getByRole("navigation", { name: "一覧のページ送り" }).textContent,
  ).toBe("前へ1–50枚 / 51枚次へ");
});
it("links each row to the card's page as a plain link and leaves independent buttons operable", () => {
  window.history.replaceState({ owner: "preserved" }, "", "/cards?q=検索市");
  render(<CardsPage />);
  const article = results().getAllByRole("article")[0];
  const link = within(article).getByRole("link");
  expect(link.getAttribute("href")).toBe("/card/test-000/");
  const button = document.createElement("button");
  button.textContent = "独立した操作";
  article.append(button);
  fireEvent.click(button);
  expect(window.location.search).toBe("?q=%E6%A4%9C%E7%B4%A2%E5%B8%82");
  expect(article.querySelectorAll("a")).toHaveLength(1);
  // The browser follows the link: nothing cancels the click, with or
  // without a modifier, and the list neither opens a detail nor moves.
  expect(fireEvent.click(link)).toBe(true);
  expect(fireEvent.click(link, { ctrlKey: true })).toBe(true);
  expect(window.location.pathname + window.location.search).toBe(
    "/cards?q=%E6%A4%9C%E7%B4%A2%E5%B8%82",
  );
  expect(document.querySelector(".card-detail-content")).toBeNull();
  expect(screen.queryByRole("button", { name: "詳細を閉じる" })).toBeNull();
  expect(results().getAllByRole("article")).toHaveLength(50);
});
it("shares the search empty state and links back to regions", () => {
  window.history.replaceState({}, "", "/cards?q=見つからない語");
  const { container } = render(<CardsPage />);
  expect(screen.queryByRole("region", { name: "地域から選ぶ" })).toBeNull();
  expect(container.querySelector(".search-empty-art")).toBeTruthy();
  expect(container.querySelector(".search-empty-state")).toBeTruthy();
  expect(
    screen.getByRole("link", { name: "地域から探す" }).getAttribute("href"),
  ).toBe("/cards");
});

it.each(["", "&pref=01"])(
  "announces an empty search only once without zero counts: %s",
  (pref) => {
    window.history.replaceState({}, "", `/cards?q=該当なし${pref}`);
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
    ).toBe("/cards");
  },
);
// Whether the map has a pin is the map's to show: a line of the list names
// the facility, or says that none is registered.
it("says nothing of map pins in the list", () => {
  window.history.replaceState({ owner: "preserved" }, "", "/cards?q=検索市");
  render(<CardsPage />);
  expect(results().queryByText(/ピン/)).toBeNull();
  expect(results().getAllByText("配布場所の登録なし")).toHaveLength(49);
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
  window.history.replaceState({}, "", "/cards?pref=01&q=該当なし");
  const { container } = render(<CardsPage />);
  const intro = within(
    container.querySelector(".catalog-intro") as HTMLElement,
  );
  expect(
    intro.getAllByRole("link", { name: "北海道の配布場所一覧ページ" }),
  ).toHaveLength(1);
  expect(intro.getByRole("link").getAttribute("href")).toBe("/pref/hokkaido/");
});
it("links every prefecture's static page below the catalog, beside the region buttons", () => {
  render(<CardsPage />);
  const hrefs = () =>
    within(
      screen.getByRole("navigation", { name: "都道府県別の配布場所ページ" }),
    )
      .getAllByRole("link")
      .map((link) => [link.textContent, link.getAttribute("href")]);
  const expected = prefecturePages.map((pref) => [
    pref.name,
    `/pref/${pref.slug}/`,
  ]);
  // Compares as the default sort does: the pair's text, by UTF-16 code unit.
  const byCodeUnit = (a: (string | null)[], b: (string | null)[]) => {
    const [x, y] = [a.join(","), b.join(",")];
    return x < y ? -1 : x > y ? 1 : 0;
  };
  expect(hrefs().sort(byCodeUnit)).toEqual(expected.sort(byCodeUnit));
  // The region buttons still filter in place, and the links stay below.
  fireEvent.click(screen.getByRole("button", { name: /^北海道/ }));
  expect(window.location.search).toBe("?pref=01");
  expect(results().getAllByRole("article")).toHaveLength(50);
  expect(hrefs()).toHaveLength(47);
});
it("filters to the received cards, pinned or not", async () => {
  vi.stubEnv("VITE_ACCOUNTS_ENABLED", "true");
  document.cookie = "signed_in=1; Path=/";
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "/api/me/records")
        return new Response('[{"cardId":"test-000","receivedOn":null}]');
      if (init?.method === "DELETE") return new Response(null, { status: 204 });
      return new Response(
        '{"cardId":"test-000","receivedOn":null,"memo":null,"updatedAt":1}',
      );
    }),
  );
  render(
    <RecordsHost>
      <CardsPage />
    </RecordsHost>,
  );
  fireEvent.click(await screen.findByRole("radio", { name: "入手済み" }));
  expect(screen.getAllByRole("article")).toHaveLength(1);
  expect(screen.getByText("test-000")).toBeTruthy();
  expect(screen.getByText("配布場所の登録なし")).toBeTruthy();
});

// The head counts the prefecture's cards and the stamps among them; what a
// search leaves is the results' to say, or "1枚 うち入手 3枚" would be read.
it("counts the whole prefecture at the head of its page while a search narrows the results", async () => {
  vi.stubEnv("VITE_ACCOUNTS_ENABLED", "true");
  document.cookie = "signed_in=1; Path=/";
  history.replaceState(null, "", "/cards?pref=01&q=test-000");
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(
          JSON.stringify(
            ["test-000", "test-001", "test-002"].map((cardId) => ({
              cardId,
              receivedOn: null,
            })),
          ),
        ),
    ),
  );
  render(
    <RecordsHost>
      <CardsPage />
    </RecordsHost>,
  );
  await screen.findByRole("radio", { name: "入手済み" });
  expect(screen.getAllByRole("article")).toHaveLength(1);
  expect(document.querySelector(".techo-count")?.textContent).toBe(
    "51枚うち入手 3枚",
  );
  // Shown, not only read out: the head no longer says how many are listed.
  const results = screen.getByRole("heading", {
    level: 2,
    name: /北海道.*1.*枚/,
  });
  expect(results.closest(".catalog-sr-only")).toBeNull();
});

it("starts at page one when a receipt filter replaces a paginated catalog", async () => {
  vi.stubEnv("VITE_ACCOUNTS_ENABLED", "true");
  document.cookie = "signed_in=1; Path=/";
  history.replaceState(null, "", "/cards?pref=01&page=2");
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () => new Response('[{"cardId":"test-000","receivedOn":null}]'),
    ),
  );
  render(
    <RecordsHost>
      <CardsPage />
    </RecordsHost>,
  );
  fireEvent.click(await screen.findByRole("radio", { name: "入手済み" }));
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
  render(
    <RecordsHost>
      <CardsPage summary={builtSummary(data)} />
    </RecordsHost>,
  );
  expect(
    await screen.findByRole("button", { name: /北海道.*51.*枚/ }),
  ).toBeTruthy();
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(fetched).not.toHaveBeenCalled();
  arrive();
  fireEvent.click(await screen.findByRole("radio", { name: "入手済み" }));
  expect(screen.getAllByRole("article")).toHaveLength(1);
  expect(fetched).toHaveBeenCalledTimes(1);
});
