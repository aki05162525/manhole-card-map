import { readMapSummary } from "../../domain/map-summary";
import { readMapFocus } from "../../features/map/map-history";
import { measureStage, placeLevel } from "../../features/map/level-placement";
import { diagnosticsEnabled } from "../../shared/browser/explorer-metrics";
import { entryState } from "../../shared/browser/app-history";
import { painted } from "../../shared/browser/painted";
import { START_FAILED, writeEarlyChoice } from "./early-choice";
import { mapSurround } from "./map-surround";

// The national drawing the map's HTML holds (`NationalStageShell`), placed
// by the script the HTML carries before its first paint, with the same
// functions the stage draws with (`level-placement.ts`): the page's script
// then replaces it with the stage, which draws the same picture.

const NATIONAL = { area: null, pref: null };

/**
 * Whether the page's map opens on the national level with the public
 * counts, as the HTML can draw it: not a card's detail (the URL's `card`),
 * not a friend's map (`friend`, whose counts wait for the friend's
 * records), and not a level the history entry keeps (a reload in a region).
 */
function opensNationally(
  url: URL,
  state: unknown,
  { accounts }: { accounts: boolean },
) {
  const params = url.searchParams;
  return (
    !params.has("card") &&
    !(accounts && params.has("friend")) &&
    readMapFocus(state).area === null
  );
}

/**
 * Places the HTML's national drawing in `root` on this screen, or takes it
 * away where the page opens elsewhere. A region pressed on it is marked and
 * kept for the page to open (`early-choice.ts`). If the page's script cannot
 * start, a press goes to the list of cards instead.
 */
export function drawFirstStage(
  root: HTMLElement,
  {
    accounts,
    go = (href) => location.assign(href),
  }: { accounts: boolean; go?: (href: string) => void },
) {
  const stage = root.querySelector<HTMLElement>("[data-first-stage]");
  const url = new URL(location.href);
  // A friend's map has the friend's header in place of the search bar.
  if (accounts && url.searchParams.has("friend"))
    root.querySelector(".map-search-bar[inert]")?.remove();
  if (!stage) return;
  const summary = readMapSummary(root.dataset);
  const placement =
    summary &&
    opensNationally(url, entryState("map"), { accounts }) &&
    placeLevel(measureStage(stage, mapSurround), NATIONAL, summary.counts, 0);
  // A screen so large that the national level shows the prefectures is
  // left to the stage: the HTML holds the regions.
  if (!placement || placement.badges.some((badge) => badge.kind !== "area")) {
    stage.remove();
    return;
  }
  const list = stage.querySelector<HTMLElement>(".level-list")!;
  let { land } = placement;
  if (placement.listed) {
    for (const badge of stage.querySelectorAll(".level-badge")) badge.remove();
    list.style.top = `${placement.listTop}px`;
    // The coast below the rows, as the stage draws it.
    land = placeLevel(
      measureStage(stage, mapSurround),
      NATIONAL,
      summary.counts,
      list.offsetHeight,
    ).land;
  } else {
    list.remove();
    for (const badge of placement.badges) {
      const button = stage.querySelector<HTMLElement>(
        `.level-badge[data-choice="${badge.id}"]`,
      )!;
      for (const [name, value] of Object.entries(badge.style))
        button.style.setProperty(name, value);
    }
  }
  stage.querySelector("path")!.setAttribute("transform", land!.transform);
  stage.setAttribute("data-measured", "");
  if (diagnosticsEnabled())
    void painted().then(() => performance.mark("national-stage-drawn"));

  let failed = false;
  stage.addEventListener("click", (event) => {
    const { target } = event;
    const button =
      target instanceof Element
        ? target.closest<HTMLElement>("button[data-choice]")
        : null;
    if (!button) return;
    if (failed) {
      go("/cards");
      return;
    }
    for (const marked of stage.querySelectorAll("[aria-current]"))
      marked.removeAttribute("aria-current");
    // Marked as the stage marks the level it is opening.
    button.setAttribute("aria-current", "true");
    writeEarlyChoice(button.dataset.choice!);
  });
  const fail = () => {
    if (!stage.isConnected) return;
    failed = true;
    if (stage.querySelector("[aria-current]")) go("/cards");
  };
  // The page's module did not load, or could not start (`main.ts`).
  addEventListener(
    "error",
    (event) => {
      if (event.target instanceof HTMLScriptElement) fail();
    },
    true,
  );
  addEventListener(START_FAILED, fail);
}
