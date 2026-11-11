import "./shared/ui/tokens.css";
import { createElement, StrictMode } from "react";
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import "@fontsource-variable/noto-sans-jp/wght.css";
import "./pages/map/style.css";

const mapRoot = document.getElementById("root")!;
void import("./pages/map/map-page").then(({ default: App }) => {
  createRoot(mapRoot).render(createElement(App));
});

// SPIKE(keep-map-alive): switch to the catalog in this document and keep the
// map's React tree and MapLibre instance mounted but hidden. Not for merging.
type SpikeWindow = Window & {
  __spikeMap?: import("maplibre-gl").Map;
  __spike?: Record<string, number>;
};
const spikeWindow = window as SpikeWindow;
const spike = (spikeWindow.__spike = {
  cardsShows: 0,
  mapShows: 0,
  lastCardsClick: 0,
  lastCardsShown: 0,
  lastMapClick: 0,
  lastMapResize: 0,
  lastMapShown: 0,
  lastMapRender: 0,
});
const mapTitle = document.title;
const cardsTitle =
  "マンホールカード一覧｜都道府県別の配布場所 - マンホール手帳";
let cardsHost: HTMLElement | null = null;
let cardsRoot: Root | null = null;
let mapEntry: { url: string; state: unknown } | null = null;

function afterPaint() {
  return new Promise<number>((resolve) =>
    requestAnimationFrame(() => setTimeout(() => resolve(performance.now()))),
  );
}
function closePopovers() {
  for (const node of document.querySelectorAll<HTMLElement>(":popover-open"))
    node.hidePopover();
}
async function showCards(started: number) {
  spike.lastCardsClick = started;
  closePopovers();
  mapRoot.hidden = true;
  mapRoot.inert = true;
  document.title = cardsTitle;
  const host = document.createElement("div");
  host.id = "cards-root";
  document.body.append(host);
  cardsHost = host;
  const { CardsPage } = await import("./pages/cards/cards-page");
  if (cardsHost !== host) return;
  cardsRoot = createRoot(host);
  flushSync(() =>
    cardsRoot!.render(
      createElement(StrictMode, null, createElement(CardsPage)),
    ),
  );
  spike.cardsShows++;
}
function showMap(started: number) {
  spike.lastMapClick = started;
  cardsRoot?.unmount();
  cardsHost?.remove();
  cardsRoot = null;
  cardsHost = null;
  mapRoot.hidden = false;
  mapRoot.inert = false;
  document.title = mapTitle;
  const map = spikeWindow.__spikeMap;
  if (map) {
    map.once("render", () => (spike.lastMapRender = performance.now()));
    map.resize();
  }
  spike.lastMapResize = performance.now();
  spike.mapShows++;
  void afterPaint().then((time) => (spike.lastMapShown = time));
}
document.addEventListener("click", (event) => {
  if (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  )
    return;
  const link = (event.target as Element | null)?.closest?.("a");
  if (!link || link.target || link.origin !== location.origin) return;
  if (link.pathname === "/cards" && !cardsHost) {
    event.preventDefault();
    mapEntry = { url: location.href, state: history.state };
    history.pushState({ spikeCards: true }, "", link.href);
    void showCards(event.timeStamp);
  } else if (link.pathname === "/" && !link.search && cardsHost) {
    event.preventDefault();
    history.pushState(mapEntry?.state ?? null, "", mapEntry?.url ?? "/");
    showMap(event.timeStamp);
  }
});
// Registered before the map's effects, so it runs first on every popstate.
addEventListener("popstate", (event) => {
  if (location.pathname === "/cards" && !cardsHost)
    void showCards(event.timeStamp);
  else if (location.pathname !== "/cards" && cardsHost)
    showMap(event.timeStamp);
});
