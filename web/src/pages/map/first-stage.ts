import { readMapSummary } from "../../domain/map-summary";
import {
  measureStage,
  nationalShowsPrefectures,
  placeLevel,
} from "../../features/map/level-placement";
import { diagnosticsEnabled } from "../../shared/browser/explorer-metrics";
import { entryState } from "../../shared/browser/app-history";
import { painted } from "../../shared/browser/painted";
import { START_FAILED, earlyChoice, writeEarlyChoice } from "./early-choice";
import { friendInUrl, opensNationally } from "./map-opening";
import { mapSurround } from "./map-surround";

// The national drawing the map's HTML holds (`NationalStageShell`), placed
// by the script the HTML carries before its first paint, with the same
// functions the stage draws with (`level-placement.ts`): the page's script
// then replaces it with the stage, which draws the same picture.
//
// What the drawing hands to the page as it is replaced:
// - where the page opens: the drawing is shown only where the page opens at
//   the same picture (`map-opening.ts`), and else taken away at once;
// - a region pressed: marked, and kept on the root (`early-choice.ts`);
// - the keyboard: read by the stage as it first draws (`level-stage.tsx`);
// - a page that cannot draw: it puts the drawing back (`app.tsx`) and says
//   so (`START_FAILED`), as the page's script that cannot load or start
//   does. The drawing then leads to the list of cards (`fail` below).

const NATIONAL = { area: null, pref: null };

/**
 * Places the HTML's national drawing in `root` on this screen, or takes it
 * away where the page opens elsewhere. A region pressed on it is marked and
 * kept for the page to open (`early-choice.ts`). If the page cannot draw,
 * the list of cards is opened instead (`go`).
 */
export function drawFirstStage(
  root: HTMLElement,
  {
    accounts,
    go = (href) => location.assign(href),
  }: { accounts: boolean; go?: (href: string) => void },
) {
  const stage = root.querySelector<HTMLElement>("[data-first-stage]");
  const url = location.href;
  // A friend's map has the friend's header in place of the search bar.
  if (friendInUrl(location.search, accounts) !== null)
    root.querySelector(".map-search-bar[inert]")?.remove();

  let failed = false;
  /**
   * The page will not draw. A drawing left to press then leads to the list,
   * and so does a press it took that the page has not opened yet. With no
   * drawing to press (the page opened elsewhere), the list is opened now:
   * the search bar the HTML holds does nothing by itself. The list opens on
   * the card the URL names, if any.
   */
  const fail = () => {
    if (failed) return;
    failed = true;
    if (!stage?.isConnected || earlyChoice() !== null) go(listHref());
    else
      for (const marked of stage.querySelectorAll("[aria-current]"))
        marked.removeAttribute("aria-current");
  };
  const listHref = () => {
    const card = new URL(url).searchParams.get("card");
    return card ? `/cards?${new URLSearchParams({ card })}` : "/cards";
  };
  // The page's module did not load, or could not start (`main.ts`), or
  // could not draw its first screen (`app.tsx`).
  addEventListener(
    "error",
    (event) => {
      if (event.target instanceof HTMLScriptElement) fail();
    },
    true,
  );
  addEventListener(START_FAILED, fail);

  if (!stage) return;
  const summary = readMapSummary(root.dataset);
  const frame =
    summary && opensNationally(url, entryState("map"), accounts)
      ? measureStage(stage, mapSurround)
      : null;
  // A screen so large that the national level shows the prefectures is
  // left to the stage: the HTML holds the regions.
  if (!summary || !frame || nationalShowsPrefectures(frame)) {
    stage.remove();
    return;
  }
  const placement = placeLevel(frame, NATIONAL, summary.counts, 0);
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

  stage.addEventListener("click", (event) => {
    const { target } = event;
    const button =
      target instanceof Element
        ? target.closest<HTMLElement>("button[data-choice]")
        : null;
    if (!button) return;
    if (failed) {
      go(listHref());
      return;
    }
    for (const marked of stage.querySelectorAll("[aria-current]"))
      marked.removeAttribute("aria-current");
    // Marked as the stage marks the level it is opening.
    button.setAttribute("aria-current", "true");
    writeEarlyChoice(button.dataset.choice!);
  });
}
