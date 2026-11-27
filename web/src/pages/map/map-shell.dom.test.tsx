import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { MapSearch } from "./map-search";
import { searchSession } from "./map-search-state";
import { renderMapShell, withMapShell } from "./map-shell";
import { countPins } from "../../domain/map-summary";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/**
 * An element as the stylesheet sees it: its tag, classes and children, and
 * the size an icon is drawn at.
 */
const outline = (element: Element): unknown => [
  element.tagName +
    (element.tagName === "svg"
      ? ` ${element.getAttribute("width")}x${element.getAttribute("height")}`
      : ""),
  // The menu's class for the side its panel opens on styles no button.
  [...element.classList]
    .filter((name) => name !== "site-menu-start")
    .sort((a, b) => a.localeCompare(b)),
  // The menu's panel is the script's; the HTML has only its button.
  [...element.children]
    .filter((child) => !child.classList.contains("site-menu-panel"))
    .map(outline),
];
/** What a reader sees in the bar: its text and the icons, in order. */
function drawn(bar: Element) {
  const shown = bar.cloneNode(true) as Element;
  // The menu's panel is the script's, and closed.
  shown.querySelector(".site-menu-panel")?.remove();
  return {
    text: shown.textContent,
    icons: [...shown.querySelectorAll("svg")]
      .map((icon) => icon.getAttribute("class") ?? "")
      .sort((a, b) => a.localeCompare(b)),
  };
}
function shellBar() {
  const page = document.createElement("div");
  page.innerHTML = withMapShell(
    '<div id="root"></div>',
    renderMapShell(countPins([])),
  );
  return page.querySelector(".explorer > .map-search-bar")!;
}

// The script replaces the HTML's bar with its own: any difference between
// the two shows as a jump when it does.
it.each([
  ["a phone", false],
  ["a wide screen", true],
])("writes into the HTML the bar the map draws on %s", (_, wide) => {
  vi.stubGlobal("matchMedia", () => ({ matches: wide }));
  const { container } = render(
    <MapSearch
      index={null}
      dataError=""
      onRetry={() => {}}
      pref={undefined}
      session={searchSession()}
      onSelect={() => {}}
      onOpen={() => {}}
      onClose={() => {}}
      onClosed={() => {}}
      onUpdate={() => {}}
    />,
  );
  const bar = container.querySelector(".map-search-bar")!;
  const shell = shellBar();
  expect(drawn(shell)).toEqual(drawn(bar));
  // The bar's parts are compared in any order: the HTML has one, and the
  // stylesheet moves the menu to where a wide screen has it.
  const sorted = (element: Element) => {
    const [tag, classes, children] = outline(element) as [
      string,
      string[],
      unknown[],
    ];
    return [
      tag,
      classes,
      children
        .map((child) => JSON.stringify(child))
        .sort((a, b) => a.localeCompare(b)),
    ];
  };
  expect(sorted(shell)).toEqual(sorted(bar));
});

it("answers nothing until the script has replaced it, and fills only an empty root", () => {
  expect(shellBar().hasAttribute("inert")).toBe(true);
  expect(() =>
    withMapShell(
      '<div id="root"><p>taken</p></div>',
      renderMapShell(countPins([])),
    ),
  ).toThrow("no empty #root");
  expect(
    withMapShell('<div id="root" data-card-count="3"></div>', "<main></main>"),
  ).toBe('<div id="root" data-card-count="3"><main></main></div>');
});
