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

// A prefecture chosen before the map engine: its facilities are drawn from
// its own file, where they stand, and pressed there. The engine is the
// mocked stage, which draws nothing and is ready when a test says so.
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
const A = "13-101-A001", // 千代田区
  B = "13-103-A001", // 港区
  C = "13-104-A001", // 新宿区
  D = "13-421-A001", // 小笠原村
  E = "13-201-A001"; // 八王子市
// [id, name, card, lat, lng]
const facilities = [
  ["p1", "千代田の窓口", A, 35.694, 139.7536],
  // About 12px east of p1 on the prefecture's drawing: under one press,
  // apart when drawn four times closer.
  ["p3", "神田の窓口", A, 35.694, 139.7666],
  // Two counters at the same coordinates.
  ["p2", "港の窓口", B, 35.658, 139.7514],
  ["p4", "芝の窓口", C, 35.658, 139.7514],
  ["p5", "八王子の窓口", E, 35.66, 139.32],
  // An island far beyond the drawing of the mainland.
  ["p6", "父島の窓口", D, 27.0942, 142.1914],
] as const;
const full: Data = {
  schema: 1,
  updated: "2026-11-20",
  cards: [
    card(A, "千代田区"),
    card(B, "港区"),
    card(C, "新宿区"),
    card(E, "八王子市"),
    card(D, "小笠原村"),
  ],
  places: facilities.map(([id, name, , lat, lng]) => ({
    id,
    name,
    address: `東京都${name}`,
    phone: "",
    coordinate: { status: "confirmed" as const, lat, lng },
  })),
  relations: facilities.map(([placeId, , cardId]) => ({
    cardId,
    placeId,
    condition: "",
    periodRaw: "",
    alternativeRaw: "",
  })),
  pins: facilities.map(([id, , cardId, lat, lng]) => ({
    id,
    kind: "place" as const,
    pref: "東京都",
    cardIds: [cardId],
    status: "active" as const,
    lat,
    lng,
  })),
};
const files = publicViews(full);
const PINS = "/data/pins.json",
  TOKYO_PLACES = "/data/places-13.json",
  TOKYO = "/data/detail-13.json";
const requests: string[] = [];
let send: (url: string) => Promise<void>;
let App: ComponentType;

beforeEach(async () => {
  vi.resetModules();
  stage.current = null;
  requests.length = 0;
  // The counts the build writes on the map's root (`vite.config.ts`).
  const root = document.createElement("div");
  root.innerHTML = `<div id="root" ${mapSummaryAttributes(summarizeMap(full))}></div>`;
  document.body.append(root.firstElementChild!);
  App = (await import("./map-page")).default;
  const waiting = new Map<string, ((response: Response) => void)[]>();
  const answered = new Set<string>();
  const answer = (url: string) =>
    new Response(JSON.stringify(files[url.slice("/data/".length)]), {
      status: files[url.slice("/data/".length)] ? 200 : 404,
    });
  send = (url) =>
    act(async () => {
      answered.add(url);
      for (const resolve of waiting.get(url) ?? []) resolve(answer(url));
      waiting.delete(url);
    });
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => {
      requests.push(url);
      if (answered.has(url)) return Promise.resolve(answer(url));
      return new Promise<Response>((resolve) =>
        waiting.set(url, [...(waiting.get(url) ?? []), resolve]),
      );
    }),
  );
  // The map's frame is a phone's; the panels over it have no size here.
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    function (this: HTMLElement) {
      const phone = this.id === "map" || this.classList.contains("level-stage");
      return new DOMRect(0, 0, phone ? 412 : 0, phone ? 915 : 0);
    },
  );
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(private report: () => void) {}
      observe() {
        queueMicrotask(() => act(() => this.report()));
      }
      disconnect() {}
    },
  );
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
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
});

/** Where the drawing shows each facility, by id. */
function drawn() {
  return new Map(
    [...document.querySelectorAll<SVGElement>("[data-pin]")].map((pin) => {
      const [, x, y] = /translate\(([-\d.e]+) ([-\d.e]+)\)/.exec(
        pin.getAttribute("transform") ?? "",
      )!;
      return [pin.dataset.pin!, { x: Number(x), y: Number(y) }];
    }),
  );
}
const drawing = () => document.querySelector<SVGElement>(".pref-stage-land")!;
/** A fingertip on the drawing at a facility's pin. */
function press(id: string) {
  const at = drawn().get(id)!;
  fireEvent.click(drawing(), { clientX: at.x, clientY: at.y });
}
/** Waits for the stage's measurement, which may set its choices out again. */
async function choose(name: string) {
  await act(async () => {});
  fireEvent.click(await screen.findByRole("button", { name }));
}
async function openTokyo() {
  render(<App />);
  await choose("関東 5枚");
  await choose("東京都 5枚");
  await send(TOKYO_PLACES);
  await waitFor(() => expect(drawn().size).toBeGreaterThan(0));
}
const sheet = () => screen.getByRole("region", { name: "カードの詳細" });

it("draws a prefecture's facilities from its own file and opens one, without the map engine", async () => {
  await openTokyo();
  // Counted from the HTML, before any file.
  expect(requests.filter((url) => url !== TOKYO_PLACES)).not.toContain(PINS);
  // Where they stand: Hachioji west of Chiyoda, both on the screen.
  const at = drawn();
  expect(at.get("p5")!.x).toBeLessThan(at.get("p1")!.x);
  for (const id of ["p1", "p2", "p5"]) {
    expect(at.get(id)!.x).toBeGreaterThan(0);
    expect(at.get(id)!.x).toBeLessThan(412);
  }
  press("p5");
  await send(TOKYO);
  expect(
    await screen.findByRole("heading", { name: "八王子市", level: 2 }),
  ).toBeTruthy();
  expect(location.search).toBe(`?card=${E}`);
  // Neither the map engine nor every pin has been asked for.
  expect(stage.current?.start ?? false).toBe(false);
  expect(requests).not.toContain(PINS);
});

it("draws a pressed spot of several facilities closer, then opens the one pressed", async () => {
  await openTokyo();
  const before = drawn();
  press("p1");
  // Nothing is chosen: the drawing comes closer around the press.
  expect(screen.queryByRole("region", { name: "カードの詳細" })).toBeNull();
  const after = drawn();
  expect(after.get("p1")!.x).toBeCloseTo(before.get("p1")!.x);
  expect(after.get("p1")!.y).toBeCloseTo(before.get("p1")!.y);
  expect(after.get("p3")!.x - after.get("p1")!.x).toBeCloseTo(
    (before.get("p3")!.x - before.get("p1")!.x) * 4,
  );
  press("p1");
  await send(TOKYO);
  expect(
    await screen.findByRole("heading", { name: "千代田区", level: 2 }),
  ).toBeTruthy();
});

it("lists counters at the same coordinates by name, and opens either", async () => {
  await openTokyo();
  press("p2");
  const ledger = screen.getByRole("region", { name: "押した所の施設" });
  const names = within(ledger)
    .getAllByRole("button", { name: /の窓口/ })
    .map((button) => button.textContent);
  expect(names).toEqual([
    expect.stringContaining("港の窓口"),
    expect.stringContaining("芝の窓口"),
  ]);
  fireEvent.click(within(ledger).getByRole("button", { name: /芝の窓口/ }));
  await send(TOKYO);
  expect(
    await screen.findByRole("heading", { name: "新宿区", level: 2 }),
  ).toBeTruthy();
  // The pins stay where they stand.
  expect(screen.queryByRole("region", { name: "押した所の施設" })).toBeNull();
  press("p2");
  fireEvent.click(
    within(screen.getByRole("region", { name: "押した所の施設" })).getByRole(
      "button",
      { name: /港の窓口/ },
    ),
  );
  expect(
    await screen.findByRole("heading", { name: "港区", level: 2 }),
  ).toBeTruthy();
});

it("offers every facility from the keyboard, the island beyond the drawing too", async () => {
  await openTokyo();
  // The island is not drawn on the mainland, nor moved onto it.
  const island = drawn().get("p6")!;
  expect(island.x > 412 || island.y > 915).toBe(true);
  const list = screen.getByRole("button", { name: /施設の一覧/ });
  expect(list.textContent).toContain("図の外 1");
  list.focus();
  fireEvent.click(list);
  const ledger = screen.getByRole("region", { name: "東京都の施設" });
  expect(
    within(ledger).getAllByRole("button", { name: /の窓口/ }),
  ).toHaveLength(6);
  fireEvent.click(within(ledger).getByRole("button", { name: /父島の窓口/ }));
  await send(TOKYO);
  expect(
    await screen.findByRole("heading", { name: "小笠原村", level: 2 }),
  ).toBeTruthy();
});

it("hands the chosen facility and its detail to the map, at the drawing's own view", async () => {
  await openTokyo();
  press("p5");
  await send(TOKYO);
  await screen.findByRole("heading", { name: "八王子市", level: 2 });
  // A drag on the drawing asks for the map that moves.
  fireEvent.wheel(drawing());
  await waitFor(() => expect(stage.current?.start).toBe(true));
  expect(requests).toContain(PINS);
  await send(PINS);
  await waitFor(() => expect(stage.current?.pinsLoaded).toBe(true));
  const view = stage.current!.stageView;
  expect(view).toMatchObject({ zoom: expect.any(Number) });
  expect(stage.current!.focus).toMatchObject({ pref: "東京都" });
  expect(stage.current!.selectedPins.map((pin) => pin.id)).toEqual(["p5"]);
  await act(async () => stage.current!.onReady(fakeAdapter()));
  // The drawing gives way; the detail and the choice stay.
  expect(document.querySelector("[data-pin]")).toBeNull();
  expect(sheet().textContent).toContain("八王子の窓口");
  expect(screen.getByRole("heading", { name: "八王子市", level: 2 })).toBe(
    document.activeElement,
  );
  expect(stage.current!.selectedPins.map((pin) => pin.id)).toEqual(["p5"]);
  expect(location.search).toBe(`?card=${E}`);
});
