import { cleanup, fireEvent, screen } from "@testing-library/react";
import { useEffect, useState } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  countPins,
  mapSummaryAttributes,
  type MapSummary,
} from "../domain/map-summary";
import { renderMapShell } from "../pages/map/map-shell";
import { drawFirstStage } from "../pages/map/first-stage";
import { START_FAILED } from "../pages/map/early-choice";
import { startScreens } from "./app";

// The map's document when its screen cannot be drawn: the HTML's own drawing
// (`first-stage.ts`) is put back, and leads to the list of cards.
const summary: MapSummary = {
  counts: countPins(
    [
      ["北海道", 12],
      ["東京都", 140],
      ["大阪府", 45],
      ["福岡県", 70],
    ].map(([pref, n]) => ({
      pref: pref as string,
      cardIds: Array.from({ length: n as number }, (_, i) => `${pref}-${i}`),
    })),
  ),
  shards: [],
};
let root: HTMLElement;
beforeEach(() => {
  document.body.innerHTML = `<div id="root" ${mapSummaryAttributes(summary)}>${renderMapShell(summary.counts)}</div>`;
  root = document.getElementById("root")!;
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    function (this: HTMLElement) {
      if (this.matches(".map-stage, .level-stage"))
        return new DOMRect(0, 0, 412, 915);
      if (this.matches(".map-search-bar")) return new DOMRect(16, 8, 380, 64);
      return new DOMRect(0, 0, 0, 0);
    },
  );
  // React reports what the screen threw.
  vi.spyOn(console, "error").mockImplementation(() => {});
  history.replaceState(null, "", "/");
});
afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

const failing = () => {
  throw new Error("first screen failed");
};
/** The drawing is put back and told that the page cannot draw. */
const putBack = () =>
  new Promise((resolve) =>
    addEventListener(START_FAILED, resolve, { once: true }),
  );

it("opens the list when the first screen fails after a press", async () => {
  const go = vi.fn();
  drawFirstStage(root, { accounts: false, go });
  fireEvent.click(screen.getByRole("button", { name: "関東 140枚" }));
  startScreens(root, "map", failing);
  await vi.waitFor(() => expect(go).toHaveBeenCalledWith("/cards"));
});

it("leaves the drawing to open the list when the first screen fails", async () => {
  const go = vi.fn();
  drawFirstStage(root, { accounts: false, go });
  const told = putBack();
  startScreens(root, "map", failing);
  await told;
  expect(go).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "関東 140枚" }));
  expect(go).toHaveBeenCalledWith("/cards");
});

it("puts the drawing back when the map fails once it has been shown", async () => {
  const go = vi.fn();
  drawFirstStage(root, { accounts: false, go });
  function FailingLater() {
    const [later, setLater] = useState(false);
    useEffect(() => setLater(true), []);
    if (later) throw new Error("the map failed");
    return <p>map</p>;
  }
  const told = putBack();
  startScreens(root, "map", FailingLater);
  await told;
  expect(go).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "九州 70枚" }));
  expect(go).toHaveBeenCalledWith("/cards");
});

it.each([
  [
    "the page's script cannot start",
    () => dispatchEvent(new Event(START_FAILED)),
  ],
  ["the first screen fails", () => startScreens(root, "map", failing)],
])(
  "opens the list where no drawing was left to press and %s",
  async (_, fail) => {
    history.replaceState({ mapSearch: { phase: "search" } }, "", "/");
    const go = vi.fn();
    drawFirstStage(root, { accounts: false, go });
    fail();
    await vi.waitFor(() => expect(go).toHaveBeenCalledWith("/cards"));
  },
);
