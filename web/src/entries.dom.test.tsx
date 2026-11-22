import { screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import type { Data } from "./domain/types";

vi.mock("./features/map/map-stage", () => ({ MapStage: () => null }));
const data: Data = {
  schema: 1,
  updated: "2026-11-06",
  evaluatedAt: "2026-11-06",
  places: [],
  relations: [],
  pins: [],
  cards: [],
};
vi.stubGlobal(
  "fetch",
  vi.fn(async () => new Response(JSON.stringify(data))),
);
vi.stubGlobal(
  "ResizeObserver",
  class {
    observe() {}
    disconnect() {}
  },
);
vi.stubGlobal("matchMedia", () => ({ matches: true }));
vi.stubGlobal("scrollTo", vi.fn());
function click(link: HTMLElement) {
  const event = new MouseEvent("click", { bubbles: true, cancelable: true });
  link.dispatchEvent(event);
  return event.defaultPrevented;
}

it("switches from the catalog entry to the map and back in the same document", async () => {
  document.body.innerHTML = '<div id="root"></div>';
  history.replaceState(null, "", "/cards");
  await import("./cards-main");

  const [mapLink] = await screen.findAllByRole("link", { name: "地図" });
  expect(click(mapLink)).toBe(true);
  await waitFor(() => expect(location.pathname).toBe("/"));

  // The map keeps its links in the menu.
  const [catalogLink] = await screen.findAllByRole("link", {
    name: "一覧",
    hidden: true,
  });
  expect(click(catalogLink)).toBe(true);
  await waitFor(() => expect(location.pathname).toBe("/cards"));
});
