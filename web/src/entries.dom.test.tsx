import { screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { Data } from "./domain/types";

vi.mock("./features/map/map-stage", () => ({ MapStage: () => null }));
const data: Data = {
  schema: 1,
  updated: "",
  evaluatedAt: "2026-11-06",
  places: [],
  relations: [],
  pins: [],
  cards: [],
};
beforeEach(() => {
  vi.resetModules();
  document.body.innerHTML = '<div id="root"></div>';
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
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
function click(link: HTMLElement) {
  const event = new MouseEvent("click", { bubbles: true, cancelable: true });
  link.dispatchEvent(event);
  return event.defaultPrevented;
}

// Each document's listener stays for the file, so the build without the
// switch runs first.
it.each([
  ["false", "/cards", false],
  ["false", "/", false],
  [undefined, "/cards", true],
])(
  "with VITE_SCREEN_SWITCH=%s, a link from %s switches: %s",
  async (flag, path, switches) => {
    if (flag) vi.stubEnv("VITE_SCREEN_SWITCH", flag);
    history.replaceState(null, "", path);
    await import(path === "/" ? "./main" : "./cards-main");
    const [link] = await screen.findAllByRole(
      "link",
      { name: path === "/" ? "一覧" : "地図", hidden: true },
      { timeout: 3000 },
    );
    expect(click(link)).toBe(switches);
    if (switches) await waitFor(() => expect(location.pathname).toBe("/"));
  },
);
