import { expect, it } from "vitest";
import { levelCamera, selectionPadding } from "./map-layout";
import { focusCamera } from "./map-levels";

/** The map's container in an explorer, and the panels placed around it. */
function explorer(bounds: DOMRect) {
  const root = document.createElement("div");
  root.className = "explorer";
  const add = (className: string, rect: DOMRect, tag = "div") => {
    const element = document.createElement(tag);
    element.className = className;
    element.getBoundingClientRect = () => rect;
    root.append(element);
    return element;
  };
  return { container: add("map", bounds), add };
}
const height = (element: HTMLElement, value: number) =>
  Object.defineProperty(element, "offsetHeight", { value });

it("measures the bar, the breadcrumbs and the sheet as it is shown, excluding the modal", () => {
  const { container, add } = explorer(new DOMRect(0, 0, 400, 800));
  add("map-search-bar", new DOMRect(0, 0, 400, 64));
  add("map-search-dialog", new DOMRect(0, 0, 400, 800), "dialog");
  const detail = add("detail-panel", new DOMRect(0, 500, 400, 800));
  height(detail, 800);
  detail.style.setProperty("--sheet-summary-height", "300px");
  const actions = document.createElement("div");
  actions.className = "detail-actions";
  height(actions, 60);
  detail.append(actions);
  expect(selectionPadding(container, 3)).toEqual({
    left: 24,
    right: 24,
    top: 84,
    bottom: 320,
  });
  // Folded away before its peek is measured, the sheet shows its action bar.
  detail.classList.add("is-collapsed");
  expect(selectionPadding(container, 3)).toMatchObject({ bottom: 80 });
  // The measured peek is taller than the bar.
  detail.style.setProperty("--sheet-peek-height", "72px");
  expect(selectionPadding(container, 3)).toMatchObject({ bottom: 92 });
  // The breadcrumbs sit under the bar, and the pins stay clear of them.
  add("map-actions", new DOMRect(180, 72, 204, 44), "nav");
  expect(selectionPadding(container, 3)).toEqual({
    left: 24,
    right: 24,
    top: 136,
    bottom: 92,
  });
});

it("keeps pins clear of a side panel, measured from the map's own corner", () => {
  const { container, add } = explorer(new DOMRect(10, 20, 1200, 800));
  add("map-search-bar", new DOMRect(10, 20, 400, 64));
  add("detail-panel", new DOMRect(810, 120, 350, 600));
  expect(selectionPadding(container, 1)).toEqual({
    left: 24,
    right: 420,
    top: 84,
    bottom: 70,
  });
});

it("shows the nation below the bar and a region clear of every panel", () => {
  const { container, add } = explorer(new DOMRect(0, 10, 412, 800));
  add("map-search-bar", new DOMRect(0, 10, 412, 70));
  const pins = [{ pref: "東京都", lng: 139.7, lat: 35.7 }];
  const nation = { area: null, pref: null };
  expect(levelCamera(container, nation, pins)).toEqual({
    ...focusCamera(nation, pins),
    padding: { left: 8, right: 8, top: 78, bottom: 16 },
  });
  const tokyo = { area: "kanto", pref: "東京都" };
  expect(levelCamera(container, tokyo, pins)).toEqual({
    ...focusCamera(tokyo, pins),
    padding: { left: 24, right: 24, top: 90, bottom: 20 },
  });
});
