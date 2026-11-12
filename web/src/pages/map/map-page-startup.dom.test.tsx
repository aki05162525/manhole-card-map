import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { ComponentProps, ComponentType } from "react";
import type { Data } from "../../domain/types";
import type { MapStage } from "../../features/map/map-stage";

// The map starts from pins.json; details.json arrives when the test says.
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

const card = (id: string, city: string): Data["cards"][number] => ({
  id,
  pref: "東京都",
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
const pins: Data["pins"] = [
  {
    id: "p1",
    kind: "place",
    cardIds: ["a"],
    pref: "東京都",
    lat: 35,
    lng: 139,
    status: "active",
  },
  {
    id: "p2",
    kind: "place",
    cardIds: ["a", "b"],
    pref: "東京都",
    lat: 36,
    lng: 140,
    status: "active",
  },
];
const details: Omit<Data, "pins"> & { pins: null } = {
  schema: 1,
  updated: "2026-10-21",
  places: ["p1", "p2"].map((id) => ({
    id,
    name: `施設${id}`,
    address: "",
    phone: "",
    coordinate: { status: "confirmed", lat: 35, lng: 139 },
  })),
  relations: [],
  pins: null,
  // A card without a confirmed place stays reachable from the search.
  cards: [card("a", "千代田区"), card("b", "港区"), card("c", "新宿区")],
};
let sendDetails: (body?: unknown) => void;
const requests: string[] = [];
let App: ComponentType;

beforeEach(async () => {
  vi.resetModules();
  App = (await import("./map-page")).default;
  stage.current = null;
  requests.length = 0;
  let resolve!: (response: Response) => void;
  const waiting = new Promise<Response>((done) => (resolve = done));
  sendDetails = (body = details) => resolve(new Response(JSON.stringify(body)));
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      requests.push(url);
      if (url === "/data/pins.json")
        return new Response(JSON.stringify({ updated: "2026-10-21", pins }));
      if (url === "/data/details.json") return waiting;
      return new Response(null, { status: 404 });
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
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
const arrive = () => act(async () => sendDetails());
const askedDetails = () => requests.includes("/data/details.json");

it("creates the map at once, gives it the pins, and asks for the details once it is ready", async () => {
  render(<App />);
  expect(stage.current?.pinsLoaded).toBe(false);
  await waitFor(() => expect(stage.current?.pinsLoaded).toBe(true));
  expect(stage.current!.pins).toEqual(pins);
  // The details share no bandwidth with what the map needs first.
  expect(requests).toEqual(["/data/pins.json"]);
  act(() => stage.current!.onReady({} as never));
  await waitFor(() => expect(askedDetails()).toBe(true));
  const shown = stage.current!.pins;
  await arrive();
  // The same pins: the map does not draw them again.
  expect(stage.current!.pins).toBe(shown);
});

it("opens a pin chosen before the details once they arrive, loading text only when late", async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  render(<App />);
  await waitFor(() => expect(stage.current?.pinsLoaded).toBe(true));
  expect(askedDetails()).toBe(false);
  act(() => stage.current!.onSelect(["a", "b"], "p2"));
  await waitFor(() => expect(askedDetails()).toBe(true));
  expect(stage.current!.selectedPins).toEqual([pins[1]]);
  const sheet = screen.getByRole("region", { name: "カードの詳細" });
  expect(sheet.textContent).not.toContain("読み込み中");
  expect(sheet.textContent).not.toContain("該当するカードはありません");
  act(() => vi.advanceTimersByTime(400));
  expect(sheet.textContent).toContain("読み込み中");
  await arrive();
  expect(screen.getByRole("listbox")).toBeTruthy();
  expect(stage.current!.selectedPins).toEqual([pins[1]]);
});

it("opens a shared card URL on its places before the details, and its detail after", async () => {
  history.replaceState(null, "", "/?card=a");
  render(<App />);
  await waitFor(() => expect(stage.current?.pinsLoaded).toBe(true));
  // The camera goes to the card's places from the first view.
  expect(stage.current!.selectedPins).toEqual(pins);
  await waitFor(() => expect(askedDetails()).toBe(true));
  await arrive();
  expect(
    await screen.findByRole("heading", { name: /東京都 千代田区/ }),
  ).toBeTruthy();
  expect(location.search).toBe("?card=a");
});

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
  history.replaceState(null, "", "/?card=a");
  render(<App />);
  await waitFor(() => expect(stage.current?.pinsLoaded).toBe(true));
  const sheet = screen.getByRole("region", { name: "カードの詳細" });
  // Waiting, the sheet keeps to its bar rather than the whole budget, so
  // that it grows, not shrinks, when the details come.
  expect(sheet.style.getPropertyValue("--sheet-summary-height")).toBe(
    `${40 + 16}px`,
  );
  await arrive();
  await screen.findByRole("heading", { name: /東京都 千代田区/ });
  expect(document.querySelector(".sheet-summary")).toBeTruthy();
  // The summary and the action bar below it, not the empty sheet before.
  expect(sheet.style.getPropertyValue("--sheet-summary-height")).toBe(
    `${40 + 300 + 80 + 16}px`,
  );
  expect(
    document
      .querySelector<HTMLElement>(".explorer")!
      .style.getPropertyValue("--sheet-action-height"),
  ).toBe("80px");
});

it("keeps a search typed before the details and shows its results after", async () => {
  render(<App />);
  await waitFor(() => expect(stage.current?.pinsLoaded).toBe(true));
  expect(askedDetails()).toBe(false);
  fireEvent.click(screen.getByRole("button", { name: "カードを検索" }));
  await waitFor(() => expect(askedDetails()).toBe(true));
  fireEvent.change(screen.getByRole("searchbox"), {
    target: { value: "新宿" },
  });
  await arrive();
  fireEvent.click(
    await screen.findByRole("button", { name: /新宿区.*東京都/ }),
  );
  expect(screen.getByRole("heading", { name: /東京都 新宿区/ })).toBeTruthy();
});

it("asks for the details at once when the map fails, for the search and the catalog", async () => {
  render(<App />);
  await waitFor(() => expect(stage.current?.pinsLoaded).toBe(true));
  expect(askedDetails()).toBe(false);
  act(() => stage.current!.onError("no WebGL"));
  await waitFor(() => expect(askedDetails()).toBe(true));
});

it("shows the data error when the details are of another generation", async () => {
  render(<App />);
  await waitFor(() => expect(stage.current?.pinsLoaded).toBe(true));
  act(() => stage.current!.onReady({} as never));
  await act(async () => sendDetails({ ...details, updated: "2026-11-05" }));
  expect(
    await screen.findByText(
      "カード情報を読み込めませんでした。通信を確認して再読み込みしてください。",
    ),
  ).toBeTruthy();
});
