import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { ComponentType } from "react";
import {
  countPins,
  mapSummaryAttributes,
  type MapSummary,
} from "../../domain/map-summary";
import { renderMapShell } from "./map-shell";
import { drawFirstStage } from "./first-stage";
import { START_FAILED } from "./early-choice";

// The national level as the map's HTML draws it before the page's script
// (`first-stage.ts`), then as the page draws it once started. The map
// engine is the mocked stage, which draws nothing.
vi.mock("../../features/map/map-stage", () => ({
  MapStage: () => null,
  readMapEngine: () => Promise.resolve(),
}));

// Cards in every region, more in some: badges of each size.
const summary: MapSummary = {
  counts: countPins(
    [
      ["北海道", 12],
      ["岩手県", 30],
      ["東京都", 140],
      ["長野県", 60],
      ["大阪府", 45],
      ["広島県", 20],
      ["愛媛県", 9],
      ["福岡県", 70],
      ["沖縄県", 4],
    ].map(([pref, n]) => ({
      pref: pref as string,
      cardIds: Array.from({ length: n as number }, (_, i) => `${pref}-${i}`),
    })),
  ),
  shards: [],
};
let size = { width: 412, height: 915 };
let MapPage: ComponentType;
let root: HTMLElement;

beforeEach(async () => {
  vi.resetModules();
  document.body.innerHTML = `<div id="root" ${mapSummaryAttributes(summary)}>${renderMapShell(summary.counts)}</div>`;
  root = document.getElementById("root")!;
  MapPage = (await import("./map-page")).default;
  // The map's frame; the search bar 72px deep from the top of it.
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    function (this: HTMLElement) {
      if (this.matches("#map, .map-stage, .level-stage"))
        return new DOMRect(0, 0, size.width, size.height);
      if (this.matches(".map-search-bar")) return new DOMRect(16, 8, 380, 64);
      return new DOMRect(0, 0, 0, 0);
    },
  );
  vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(
    function (this: HTMLElement) {
      return this.matches(".level-list") ? 180 : 0;
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
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  }));
  vi.stubGlobal(
    "fetch",
    vi.fn(() => new Promise(() => {})),
  );
  history.replaceState(null, "", "/");
});
afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

/** What the drawing shows, as the stylesheet places it. */
function drawing() {
  const stage = document.querySelector(".level-stage")!;
  const badges = [...stage.querySelectorAll<HTMLElement>(".level-badge")].map(
    (badge) => ({
      id: badge.dataset.choice,
      label: badge.getAttribute("aria-label"),
      text: badge.textContent,
      anchor: badge.dataset.anchor,
      style: ["left", "top", "--badge-radius", "--badge-reach", "--badge-value"]
        .map((name) => badge.style.getPropertyValue(name))
        .join(" "),
    }),
  );
  const list = stage.querySelector<HTMLElement>(".level-list");
  const locate = document.getElementById("locate")!;
  return {
    // Disabled until the map is handed over, from the first paint on.
    locate: [
      locate.getAttribute("aria-label"),
      locate.matches(":disabled"),
      locate.innerHTML,
    ],
    measured: stage.hasAttribute("data-measured"),
    land: stage.querySelector("path")?.getAttribute("transform"),
    badges,
    list: list && {
      top: list.style.top,
      rows: [...list.querySelectorAll("button")].map((row) => [
        row.dataset.choice,
        row.textContent,
      ]),
    },
  };
}
async function start() {
  render(<MapPage />, { container: root });
  // The stage's measurement.
  await act(async () => {});
}

it.each([
  ["a phone", 412, 915],
  // The regions' badges lie over each other: listed in rows.
  ["a phone held sideways", 915, 412],
  ["a small phone", 320, 480],
  ["a wide screen", 1280, 800],
])(
  "draws on %s what the stage draws once the page has started",
  async (_, width, height) => {
    size = { width, height };
    drawFirstStage(root, { accounts: false });
    const first = drawing();
    expect(first.measured).toBe(true);
    expect(first.land).toMatch(/^translate\(/);
    expect(first.badges.length + (first.list?.rows.length ?? 0)).toBe(9);
    await start();
    expect(drawing()).toEqual(first);
  },
);

it("opens a region pressed before the page had started, once", async () => {
  drawFirstStage(root, { accounts: false });
  const kanto = screen.getByRole("button", { name: "関東 140枚" });
  // A button that the keyboard reaches too, outside the bar's `inert`.
  expect(kanto.closest("[inert]")).toBeNull();
  fireEvent.click(kanto);
  expect(kanto.getAttribute("aria-current")).toBe("true");
  const entries = history.length;
  await start();
  // The keyboard goes on from the region's choices, as after a press there.
  expect(document.activeElement).toBe(
    screen.getByRole("group", { name: "関東の都道府県を選ぶ" }),
  );
  expect(history.state.mapFocus).toEqual({ area: "kanto", pref: null });
  expect(history.length).toBe(entries + 1);
  // A map made again (another screen and back) opens nothing more.
  cleanup();
  render(<MapPage />);
  await act(async () => {});
  expect(history.length).toBe(entries + 1);
});

it("opens the region of one prefecture as its prefecture, as the stage does", async () => {
  drawFirstStage(root, { accounts: false });
  fireEvent.click(screen.getByRole("button", { name: "北海道 12枚" }));
  await start();
  expect(history.state.mapFocus).toEqual({
    area: "hokkaido",
    pref: "北海道",
  });
});

it("opens the list instead when the page's script cannot start", () => {
  const go = vi.fn();
  drawFirstStage(root, { accounts: false, go });
  fireEvent.click(screen.getByRole("button", { name: "関東 140枚" }));
  expect(go).not.toHaveBeenCalled();
  dispatchEvent(new Event(START_FAILED));
  expect(go).toHaveBeenCalledWith("/cards");
  fireEvent.click(screen.getByRole("button", { name: "九州 70枚" }));
  expect(go).toHaveBeenCalledTimes(2);
});

it("marks when the national level is drawn, for the measurements", async () => {
  window.enableMapDiagnostics = true;
  try {
    drawFirstStage(root, { accounts: false });
    await vi.waitFor(() =>
      expect(performance.getEntriesByName("national-stage-drawn")).toHaveLength(
        1,
      ),
    );
  } finally {
    delete window.enableMapDiagnostics;
    performance.clearMarks();
  }
});
