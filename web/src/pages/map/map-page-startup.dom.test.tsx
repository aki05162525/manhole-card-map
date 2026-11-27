import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { ComponentProps, ComponentType } from "react";
import type { Data } from "../../domain/types";
import type { MapStage } from "../../features/map/map-stage";
import { fakeAdapter } from "../../features/map/fake-adapter";
import { publicViews } from "../../domain/public-views";
import { mapSummaryAttributes, summarizeMap } from "../../domain/map-summary";

// The map's first view reads no file: its counts are in the HTML. A
// prefecture chosen asks for its facilities, the map engine for every pin
// (pins.json), a chosen pin or card for its prefecture's details, and the
// search for the national index; each arrives when the test says.
const stage = vi.hoisted(() => ({
  current: null as ComponentProps<typeof MapStage> | null,
}));
vi.mock("../../features/map/map-stage", () => ({
  MapStage: (props: ComponentProps<typeof MapStage>) => {
    stage.current = props;
    return null;
  },
}));
vi.mock("../../shared/browser/painted", () => ({
  painted: () => new Promise<void>(() => {}),
}));
const reloadPage = vi.hoisted(() => vi.fn());
vi.mock("../../shared/browser/reload-page", () => ({ reloadPage }));

const card = (
  id: string,
  city: string,
  pref = "東京都",
): Data["cards"][number] => ({
  id,
  pref,
  city,
  series: "",
  issued: "",
  acquired: "",
  status: "active",
  lid: { status: "unconfirmed" },
  placeText: null,
  hours: null,
  links: null,
});
const A = "13-101-A001",
  B = "13-103-A001",
  C = "13-104-A001",
  OSAKA = "27-100-A001";
const pin = (id: string, cardIds: string[], pref = "東京都") => ({
  id,
  kind: "place" as const,
  cardIds,
  pref,
  lat: 35,
  lng: 139,
  status: "active" as const,
});
const pins: Data["pins"] = [
  pin("p1", [A]),
  pin("p2", [A, B]),
  pin("p3", [OSAKA], "大阪府"),
];
const place = (id: string) => ({
  id,
  name: `施設${id}`,
  address: "",
  phone: "",
  coordinate: { status: "confirmed" as const, lat: 35, lng: 139 },
});
const envelope = { schema: 1, updated: "2026-10-21" };
const full: Data = {
  ...envelope,
  // A card without a confirmed place stays reachable from the search.
  cards: [
    card(A, "千代田区"),
    card(B, "港区"),
    card(C, "新宿区"),
    card(OSAKA, "大阪市", "大阪府"),
  ],
  places: ["p1", "p2", "p3"].map(place),
  relations: [
    [A, "p1"],
    [A, "p2"],
    [B, "p2"],
    [OSAKA, "p3"],
  ].map(([cardId, placeId]) => ({
    cardId,
    placeId,
    condition: "",
    periodRaw: "",
    alternativeRaw: "",
  })),
  pins,
};
// What the build serves from this data (`scripts/build/served-data.ts`).
const files = publicViews(full);
const PINS = "/data/pins.json",
  TOKYO_PLACES = "/data/places-13.json",
  SEARCH = "/data/search.json",
  TOKYO = "/data/detail-13.json",
  OSAKA_FILE = "/data/detail-27.json";
const requests: string[] = [];
/** Answers each waiting request for the file, and those that follow. */
let send: (url: string, body?: unknown, status?: number) => Promise<void>;
let App: ComponentType;

beforeEach(async () => {
  vi.resetModules();
  // The counts the build writes on the map's root (`vite.config.ts`).
  const root = document.createElement("div");
  root.innerHTML = `<div id="root" ${mapSummaryAttributes(summarizeMap(full))}></div>`;
  document.body.append(root.firstElementChild!);
  App = (await import("./map-page")).default;
  stage.current = null;
  reloadPage.mockClear();
  requests.length = 0;
  const waiting = new Map<string, ((response: Response) => void)[]>();
  const answers = new Map<string, () => Response>([
    [PINS, () => new Response(JSON.stringify(files["pins.json"]))],
  ]);
  send = (url, body = files[url.slice("/data/".length)], status = 200) =>
    act(async () => {
      const answer = () => new Response(JSON.stringify(body), { status });
      answers.set(url, answer);
      for (const resolve of waiting.get(url) ?? []) resolve(answer());
      waiting.delete(url);
    });
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => {
      requests.push(url);
      const answer = answers.get(url);
      if (answer) return Promise.resolve(answer());
      if (
        ![SEARCH, TOKYO, OSAKA_FILE].includes(url) &&
        !url.startsWith("/data/places-")
      )
        return Promise.resolve(new Response(null, { status: 404 }));
      return new Promise<Response>((resolve) =>
        waiting.set(url, [...(waiting.get(url) ?? []), resolve]),
      );
    }),
  );
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.stubGlobal("matchMedia", () => ({ matches: true }));
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function () {
    this.open = false;
  };
  history.replaceState(null, "", "/");
});
afterEach(() => {
  cleanup();
  document.getElementById("root")?.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
const asked = (url: string) => requests.filter((item) => item === url).length;
/** The map that moves, asked for by a wheel on the drawing before it. */
function startMap() {
  fireEvent.wheel(document.querySelector(".level-stage")!);
}
/** The page with its map engine read and every pin received. */
async function openMap() {
  render(<App />);
  startMap();
  await waitFor(() => expect(stage.current?.pinsLoaded).toBe(true));
}
const sheet = () => screen.getByRole("region", { name: "カードの詳細" });

it("reads no file for the first view, then the map engine with every pin, and nothing more when it is ready", async () => {
  render(<App />);
  expect(stage.current?.start).toBe(false);
  expect(requests).toEqual([]);
  startMap();
  expect(stage.current?.start).toBe(true);
  expect(stage.current?.pinsLoaded).toBe(false);
  await waitFor(() => expect(stage.current?.pinsLoaded).toBe(true));
  expect(stage.current!.pins).toEqual(pins);
  const shown = stage.current!.pins;
  await act(async () => stage.current!.onReady(fakeAdapter()));
  // Looking at the map reads no card's details and no search index.
  expect(requests).toEqual([PINS]);
  expect(stage.current!.pins).toBe(shown);
});

it("opens a pin with only its prefecture's details, loading text only when late", async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  await openMap();
  const shown = stage.current!.pins;
  act(() => stage.current!.onSelect([A, B], "p2"));
  await waitFor(() => expect(asked(TOKYO)).toBe(1));
  expect(stage.current!.selectedPins).toEqual([pins[1]]);
  expect(sheet().textContent).not.toContain("読み込み中");
  expect(sheet().textContent).not.toContain("該当するカードはありません");
  act(() => {
    vi.advanceTimersByTime(400);
  });
  expect(sheet().textContent).toContain("読み込み中");
  await send(TOKYO);
  expect(screen.getByRole("listbox")).toBeTruthy();
  expect(stage.current!.selectedPins).toEqual([pins[1]]);
  expect(requests).toEqual([PINS, TOKYO]);
  // The same pins: the map does not draw them again.
  expect(stage.current!.pins).toBe(shown);
});

it("reads a prefecture's details ahead of a tap once the map has gone there", async () => {
  await openMap();
  await act(async () => stage.current!.onReady(fakeAdapter()));
  act(() => stage.current!.onFocus({ area: "kanto", pref: "東京都" }));
  await waitFor(() => expect(requests).toEqual([PINS, TOKYO]));
  // The tap that follows asks for nothing more.
  await send(TOKYO);
  act(() => stage.current!.onSelect([A], "p1"));
  expect(
    await screen.findByRole("heading", { name: "千代田区", level: 2 }),
  ).toBeTruthy();
  expect(requests).toEqual([PINS, TOKYO]);
});

it("opens a shared card URL on its places before the details, and its detail after", async () => {
  history.replaceState(null, "", `/?card=${A}`);
  render(<App />);
  // Asked with the pins, not after them.
  expect([...requests].sort()).toEqual([TOKYO, PINS]);
  await waitFor(() => expect(stage.current?.pinsLoaded).toBe(true));
  // The camera goes to the card's places from the first view.
  expect(stage.current!.selectedPins).toEqual([pins[0], pins[1]]);
  await send(TOKYO);
  expect(
    await screen.findByRole("heading", { name: "千代田区", level: 2 }),
  ).toBeTruthy();
  expect(location.search).toBe(`?card=${A}`);
  expect(requests).toHaveLength(2);
});

it("tells a shared URL for a card that does not exist, without failing the map", async () => {
  history.replaceState(null, "", "/?card=99-999-Z999");
  await openMap();
  expect(
    await screen.findByText(/指定されたカードは見つかりません/),
  ).toBeTruthy();
  expect(screen.queryByRole("region", { name: "カードの詳細" })).toBeNull();
});

it("shows the pin chosen last, whichever details arrive first", async () => {
  await openMap();
  act(() => stage.current!.onSelect([OSAKA], "p3"));
  act(() => stage.current!.onSelect([A], "p1"));
  await send(TOKYO);
  expect(
    await screen.findByRole("heading", { name: "千代田区", level: 2 }),
  ).toBeTruthy();
  await send(OSAKA_FILE);
  expect(screen.getByRole("heading", { level: 2 }).textContent).toBe(
    "千代田区",
  );
  expect(stage.current!.selectedPins).toEqual([pins[0]]);
});

it("offers the details again when they fail, and keeps the map", async () => {
  await openMap();
  act(() => stage.current!.onSelect([A], "p1"));
  await send(TOKYO, null, 503);
  const retry = await screen.findByRole("button", { name: "再試行" });
  // The map and the chosen pin are as they were.
  expect(stage.current!.selectedPins).toEqual([pins[0]]);
  expect(screen.queryByText(/検索と一覧も使えません/)).toBeNull();
  await send(TOKYO);
  fireEvent.click(retry);
  expect(
    await screen.findByRole("heading", { name: "千代田区", level: 2 }),
  ).toBeTruthy();
});

it.each([{}, { ...files["detail-13.json"], updated: "2026-11-05" }])(
  "does not show details that are invalid or from another generation",
  async (body) => {
    await openMap();
    act(() => stage.current!.onSelect([A], "p1"));
    await send(TOKYO, body);
    expect(await screen.findByRole("button", { name: "再試行" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "千代田区" })).toBeNull();
  },
);

it("measures the phone's summary sheet again once the details fill it", async () => {
  // A phone: the sheet floats, and its parts have their heights.
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(412);
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(915);
  const heights: Record<string, number> = {
    "detail-actions": 40,
    "sheet-summary": 300,
    "sheet-action-bar": 80,
  };
  vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(
    function (this: HTMLElement) {
      // The summary waiting for the details is empty until 400ms.
      if (this.classList.contains("sheet-summary") && !this.textContent)
        return 0;
      return heights[this.classList[0]] ?? 100;
    },
  );
  history.replaceState(null, "", `/?card=${A}`);
  await openMap();
  // Waiting, the sheet keeps to its bar rather than the whole budget, so
  // that it grows, not shrinks, when the details come.
  expect(sheet().style.getPropertyValue("--sheet-summary-height")).toBe(
    `${40 + 16}px`,
  );
  await send(TOKYO);
  await screen.findByRole("heading", { name: "千代田区", level: 2 });
  expect(document.querySelector(".sheet-summary")).toBeTruthy();
  // The summary and the action bar below it, not the empty sheet before.
  expect(sheet().style.getPropertyValue("--sheet-summary-height")).toBe(
    `${40 + 300 + 80 + 16}px`,
  );
  expect(
    document
      .querySelector<HTMLElement>(".explorer")!
      .style.getPropertyValue("--sheet-action-height"),
  ).toBe("80px");
});

it("searches the national index, and reads a result's details only when it is chosen", async () => {
  await openMap();
  fireEvent.click(screen.getByRole("button", { name: "カードを検索" }));
  await waitFor(() => expect(asked(SEARCH)).toBe(1));
  fireEvent.change(screen.getByRole("searchbox"), {
    target: { value: "新宿" },
  });
  await send(SEARCH);
  expect(requests).toEqual([PINS, SEARCH]);
  // A card whose place has no position is found all the same.
  fireEvent.click(
    await screen.findByRole("button", { name: /新宿区.*東京都/ }),
  );
  await send(TOKYO);
  expect(
    await screen.findByRole("heading", { name: "新宿区", level: 2 }),
  ).toBeTruthy();
  expect(requests).toEqual([PINS, SEARCH, TOKYO]);
});

it("keeps the search when the map fails, and asks for the index only then", async () => {
  await openMap();
  act(() => stage.current!.onError("no WebGL"));
  expect(requests).toEqual([PINS]);
  fireEvent.click(screen.getByRole("button", { name: "カードを検索" }));
  fireEvent.change(screen.getByRole("searchbox"), {
    target: { value: "大阪" },
  });
  await send(SEARCH);
  expect(
    await screen.findByRole("button", { name: /大阪市.*大阪府/ }),
  ).toBeTruthy();
});

it("offers the search index again when it fails", async () => {
  await openMap();
  fireEvent.click(screen.getByRole("button", { name: "カードを検索" }));
  fireEvent.change(screen.getByRole("searchbox"), {
    target: { value: "港" },
  });
  await send(SEARCH, null, 503);
  const retry = await screen.findByRole("button", { name: "再試行" });
  await send(SEARCH);
  fireEvent.click(retry);
  expect(
    await screen.findByRole("button", { name: /港区.*東京都/ }),
  ).toBeTruthy();
});

it.each([
  ["a pin tapped", ""],
  ["a shared URL", `/?card=${OSAKA}`],
])(
  "shows a shared pin's cards without the details of %s before it",
  async (_name, url) => {
    if (url) history.replaceState(null, "", url);
    await openMap();
    if (!url) act(() => stage.current!.onSelect([OSAKA], "p3"));
    await waitFor(() => expect(asked(OSAKA_FILE)).toBe(1));
    act(() => stage.current!.onSelect([A, B], "p2"));
    // The URL names no card of the pin left behind: a reload would open it.
    expect(location.search).toBe("");
    await send(TOKYO);
    expect(screen.getByRole("listbox")).toBeTruthy();
    expect(stage.current!.selectedPins).toEqual([pins[1]]);
    // Osaka's late answer changes nothing.
    await send(OSAKA_FILE);
    expect(screen.getByRole("listbox")).toBeTruthy();
    expect(screen.queryByText(/見つかりません/)).toBeNull();
    // A card of the pin is the URL's again.
    fireEvent.click(screen.getByRole("button", { name: /港区/ }));
    expect(
      await screen.findByRole("heading", { name: "港区", level: 2 }),
    ).toBeTruthy();
    expect(location.search).toBe(`?card=${B}`);
  },
);

it("goes back to the card left waiting, and waits for its details alone", async () => {
  history.replaceState(null, "", `/?card=${OSAKA}`);
  await openMap();
  act(() => stage.current!.onSelect([A], "p1"));
  await send(TOKYO);
  expect(
    await screen.findByRole("heading", { name: "千代田区", level: 2 }),
  ).toBeTruthy();
  act(() => history.back());
  await waitFor(() => expect(location.search).toBe(`?card=${OSAKA}`));
  await waitFor(() =>
    expect(screen.queryByRole("heading", { name: "千代田区" })).toBeNull(),
  );
  expect(stage.current!.selectedPins).toEqual([pins[2]]);
  await send(OSAKA_FILE);
  expect(
    await screen.findByRole("heading", { name: "大阪市", level: 2 }),
  ).toBeTruthy();
});

it("reloads the page at the chosen card when its details are of a generation no longer served", async () => {
  await openMap();
  act(() => stage.current!.onSelect([A], "p1"));
  // The deployment has moved on: this document's files are gone.
  await send(TOKYO, null, 404);
  // Asking the same URL again cannot help, so no retry is offered.
  const reload = await screen.findByRole("button", { name: "再読み込み" });
  expect(screen.queryByRole("button", { name: "再試行" })).toBeNull();
  expect(sheet().textContent).toContain("更新されました");
  const before = asked(TOKYO);
  fireEvent.click(reload);
  expect(reloadPage).toHaveBeenCalledOnce();
  expect(asked(TOKYO)).toBe(before);
  // The reloaded page opens the same card.
  expect(location.search).toBe(`?card=${A}`);
  expect(stage.current!.selectedPins).toEqual([pins[0]]);
});

it("reloads the page when the search index is of a generation no longer served", async () => {
  await openMap();
  fireEvent.click(screen.getByRole("button", { name: "カードを検索" }));
  fireEvent.change(screen.getByRole("searchbox"), {
    target: { value: "港" },
  });
  await send(SEARCH, null, 404);
  fireEvent.click(await screen.findByRole("button", { name: "再読み込み" }));
  expect(screen.queryByRole("button", { name: "再試行" })).toBeNull();
  expect(reloadPage).toHaveBeenCalledOnce();
});

it("opens a search result's details when the pins could not be read", async () => {
  await send(PINS, null, 503);
  render(<App />);
  startMap();
  const notice = await screen.findByRole("alert");
  // The search and the catalog do not read the pins.
  expect(notice.textContent).toContain("地図のピンを読み込めませんでした");
  expect(notice.textContent).not.toContain("使えません");
  fireEvent.click(screen.getByRole("button", { name: "カードを検索" }));
  fireEvent.change(screen.getByRole("searchbox"), {
    target: { value: "大阪" },
  });
  await send(SEARCH);
  fireEvent.click(
    await screen.findByRole("button", { name: /大阪市.*大阪府/ }),
  );
  await send(OSAKA_FILE);
  expect(
    await screen.findByRole("heading", { name: "大阪市", level: 2 }),
  ).toBeTruthy();
  // Without the pins, nothing is said about where the card is on the map.
  expect(sheet().textContent).not.toContain("地図は移動していません");
  expect(sheet().textContent).toContain("施設p3");
});

// The map engine is the mocked stage: it draws nothing and is ready only
// when a test says so.
const level = (name: RegExp) => screen.queryByRole("button", { name });

it("lets a region and then a prefecture be chosen while the map engine has not started", async () => {
  render(<App />);
  // Counted from the HTML: no file is read for them.
  fireEvent.click(screen.getByRole("button", { name: "関東 2枚" }));
  expect(stage.current!.focus).toEqual({ area: "kanto", pref: null });
  expect(
    screen.getByRole("navigation", { name: "地図の移動" }).textContent,
  ).toContain("関東");
  // The region's prefectures are read ahead of a choice.
  expect(requests).toContain(TOKYO_PLACES);
  expect(requests).toContain("/data/places-14.json");
  // The cards counted are the map's: two in Tokyo, one of them at two places.
  fireEvent.click(await screen.findByRole("button", { name: "東京都 2枚" }));
  expect(stage.current!.focus).toEqual({ area: "kanto", pref: "東京都" });
  // Until its facilities have come, the region stays, the prefecture marked.
  expect(
    level(/^東京都/)!.getAttribute("aria-current"),
    "the prefecture the drawing will open over",
  ).toBe("true");
  expect(screen.getByRole("status").textContent).toContain(
    "東京都の施設を読み込んでいます",
  );
  // Its details are read ahead once its facilities have come.
  await send(TOKYO_PLACES);
  await waitFor(() => expect(asked(TOKYO)).toBe(1));
  expect(requests).not.toContain(PINS);
  expect(stage.current!.start).toBe(false);
  // Back, as from the drawn map.
  act(() => history.back());
  await waitFor(() =>
    expect(stage.current!.focus).toEqual({ area: "kanto", pref: null }),
  );
  expect(level(/^東京都/)!.hasAttribute("aria-current")).toBe(false);
  act(() => history.back());
  expect(await screen.findByRole("button", { name: "関東 2枚" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "近畿 1枚" })).toBeTruthy();
});

it("gives the choices over to the map once it is ready, at the level chosen", async () => {
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "関東 2枚" }));
  await act(async () => stage.current!.onReady(fakeAdapter()));
  expect(stage.current!.focus).toEqual({ area: "kanto", pref: null });
  expect(level(/^東京都/)).toBeNull();
  expect(screen.queryByRole("group", { name: /都道府県を選ぶ/ })).toBeNull();
});

it("keeps the choices with a map that failed, and tells the way to the list", async () => {
  render(<App />);
  startMap();
  const kanto = screen.getByRole("button", { name: "関東 2枚" });
  kanto.focus();
  act(() => stage.current!.onError("no WebGL"));
  expect(document.activeElement).toBe(kanto);
  expect(screen.getByRole("group", { name: "地方を選ぶ" })).toBeTruthy();
  expect(screen.getByRole("alert").textContent).toContain("一覧");
});

it("offers a chosen region's prefectures alone, and keeps the keyboard among the choices", async () => {
  render(<App />);
  const kanto = screen.getByRole("button", { name: "関東 2枚" });
  kanto.focus();
  fireEvent.click(kanto);
  const choices = screen.getByRole("group", { name: "関東の都道府県を選ぶ" });
  // No prefecture of another region, on the screen or beyond its edge.
  expect(
    within(choices)
      .getAllByRole("button")
      .map((button) => button.getAttribute("aria-label")),
  ).toEqual([
    "茨城県 0枚",
    "栃木県 0枚",
    "群馬県 0枚",
    "埼玉県 0枚",
    "千葉県 0枚",
    "東京都 2枚",
    "神奈川県 0枚",
  ]);
  // The button pressed is gone: the next Tab starts from what replaced it.
  expect(document.activeElement).toBe(choices);
  // A prefecture pressed stays where it is, the keyboard on it.
  const tokyo = within(choices).getByRole("button", { name: "東京都 2枚" });
  tokyo.focus();
  fireEvent.click(tokyo);
  expect(document.activeElement).toBe(level(/^東京都/));
  // The trail's way back loses its own button too.
  const national = screen.getByRole("button", { name: "全国" });
  national.focus();
  fireEvent.click(national);
  expect(document.activeElement).toBe(
    screen.getByRole("group", { name: "地方を選ぶ" }),
  );
});

it("hands the keyboard to the map with the choices, and leaves it when it is elsewhere", async () => {
  render(<App />);
  const kanto = screen.getByRole("button", { name: "関東 2枚" });
  kanto.focus();
  await act(async () => stage.current!.onReady(fakeAdapter()));
  expect(document.activeElement).toBe(document.getElementById("map"));
  cleanup();
  render(<App />);
  const search = screen.getByRole("button", { name: /検索/ });
  search.focus();
  await act(async () => stage.current!.onReady(fakeAdapter()));
  expect(document.activeElement).toBe(search);
});
