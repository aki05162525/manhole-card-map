import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { useEffect, type ComponentProps } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { Data } from "../domain/types";
import type { MapStage } from "../features/map/map-stage";
import { screenMeta } from "./document-meta";

// Each test is a new document: the history layer, the shared data and the
// screens keep their state for the life of one.
let App: typeof import("./app").App;
let CatalogScreen: typeof import("./catalog-screen").default;
let MapScreen: typeof import("./map-screen").default;

// The map component stands in for MapLibre: a mount is a map created.
const stage = vi.hoisted(() => ({
  current: null as ComponentProps<typeof MapStage> | null,
  created: 0,
  removed: 0,
}));
vi.mock("../features/map/map-stage", () => ({
  MapStage: (props: ComponentProps<typeof MapStage>) => {
    stage.current = props;
    useEffect(() => {
      stage.created++;
      return () => {
        stage.removed++;
      };
    }, []);
    return null;
  },
}));
vi.mock("../shared/browser/painted", () => ({
  painted: () => Promise.resolve(),
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
const data: Data = {
  schema: 1,
  updated: "2026-11-06",
  evaluatedAt: "2026-11-06",
  places: ["p1", "p2"].map((id) => ({
    id,
    name: `施設${id}`,
    address: "",
    phone: "",
    coordinate: { status: "confirmed", lat: 35, lng: 139 },
  })),
  relations: [
    {
      cardId: "a",
      placeId: "p1",
      condition: "",
      periodRaw: "",
      alternativeRaw: "",
      review: "verified",
    },
    {
      cardId: "b",
      placeId: "p2",
      condition: "",
      periodRaw: "",
      alternativeRaw: "",
      review: "verified",
    },
  ],
  pins: [
    {
      id: "p1",
      kind: "place",
      cardIds: ["a"],
      pref: "東京都",
      lat: 35,
      lng: 139,
      status: "active",
    },
    {
      id: "p2",
      kind: "place",
      cardIds: ["b"],
      pref: "東京都",
      lat: 36,
      lng: 140,
      status: "active",
    },
  ],
  cards: [card("a", "千代田区"), card("b", "港区")],
};
const meta = { map: screenMeta.map(2), catalog: screenMeta.catalog(2) };
const requests: string[] = [];
let scroll = 0;
const scrolled = vi.fn((_x: number, y: number) => (scroll = y));

function head(route: "map" | "catalog") {
  const { title, url } = meta[route];
  document.title = title;
  document.head.innerHTML = `<link rel="canonical" href="${url}"><meta property="og:url" content="${url}"><meta name="description" content=""><meta name="viewport" content="">`;
}
function start(
  route: "map" | "catalog",
  url: string,
  props: Partial<ComponentProps<typeof App>> = {},
) {
  history.replaceState(null, "", url);
  head(route);
  return render(
    <App
      initial={route}
      screens={{ [route]: route === "map" ? MapScreen : CatalogScreen }}
      meta={meta}
      {...props}
    />,
  );
}
/** The screen on view; the other stays mounted, hidden. */
function shown() {
  const slots = document.querySelectorAll<HTMLElement>(
    ".app-screen:not([data-inactive])",
  );
  expect(slots).toHaveLength(1);
  return slots[0];
}
const route = () => shown().dataset.route;
async function follow(name: string | RegExp) {
  const link = within(shown()).getAllByRole("link", { name, hidden: true })[0];
  const event = new MouseEvent("click", { bubbles: true, cancelable: true });
  act(() => {
    link.dispatchEvent(event);
  });
  return event;
}
async function travel(direction: "back" | "forward") {
  await act(async () => {
    const moved = new Promise<void>((resolve) =>
      window.addEventListener("popstate", () => resolve(), { once: true }),
    );
    history[direction]();
    await moved;
  });
}

beforeEach(async () => {
  vi.resetModules();
  ({ App } = await import("./app"));
  CatalogScreen = (await import("./catalog-screen")).default;
  MapScreen = (await import("./map-screen")).default;
  stage.current = null;
  stage.created = stage.removed = 0;
  requests.length = 0;
  scroll = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      requests.push(`${init?.method ?? "GET"} ${url}`);
      if (url.startsWith("/data/")) return new Response(JSON.stringify(data));
      // Each user's own records, told apart by the session mark.
      if (url === "/api/me/records")
        return new Response(
          document.cookie.includes("session_mark=a1")
            ? '[{"cardId":"a","receivedOn":"2026-11-01"}]'
            : "[]",
        );
      if (init?.method === "PUT")
        return new Response(JSON.stringify({ receivedOn: "2026-11-12" }));
      return new Response(null, { status: 404 });
    }),
  );
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.stubGlobal("matchMedia", () => ({ matches: true }));
  vi.stubGlobal("scrollTo", scrolled);
  Object.defineProperty(window, "scrollY", {
    configurable: true,
    get: () => scroll,
  });
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function () {
    this.open = false;
  };
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  scrolled.mockClear();
  document.cookie = "signed_in=; Max-Age=0; Path=/";
  document.cookie = "session_mark=; Max-Age=0; Path=/";
});

it("keeps one map across round trips and gives the catalog back as it was left", async () => {
  start("catalog", "/cards");
  fireEvent.click(await screen.findByRole("button", { name: /東京都/ }));
  fireEvent.click(screen.getByRole("link", { name: /千代田区 a/ }));
  expect(location.search).toBe("?pref=13&card=a");
  scroll = 300;

  expect((await follow("地図")).defaultPrevented).toBe(true);
  await waitFor(() => expect(route()).toBe("map"));
  expect(location.pathname + location.search).toBe("/");
  expect(document.title).toBe(meta.map.title);
  expect(
    document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href,
  ).toBe(meta.map.url);
  expect(document.activeElement).toBe(
    within(shown()).getByRole("heading", { level: 1 }),
  );
  act(() => stage.current!.onSelect(["b"], "p2"));
  expect(location.search).toBe("?card=b");

  await follow("一覧");
  await waitFor(() => expect(route()).toBe("catalog"));
  expect(location.pathname + location.search).toBe("/cards?pref=13&card=a");
  expect(
    within(shown()).getByRole("region", { name: /千代田区/ }),
  ).toBeTruthy();
  expect(scrolled).toHaveBeenLastCalledWith(0, 300);
  expect(document.title).toBe(meta.catalog.title);
  expect(document.activeElement).toBe(
    within(shown()).getByRole("heading", { level: 1 }),
  );

  await follow("地図");
  await waitFor(() => expect(route()).toBe("map"));
  // The camera and the detail are the ones left.
  expect(location.search).toBe("?card=b");
  expect(within(shown()).getByRole("region", { name: "カードの詳細" }));
  expect(stage.created).toBe(1);
  expect(stage.removed).toBe(0);
  // Back and forward cross the screens with each screen's own state.
  await travel("back");
  expect(route()).toBe("catalog");
  expect(location.search).toBe("?pref=13&card=a");
  await travel("back");
  expect(route()).toBe("map");
  expect(location.search).toBe("?card=b");
  await travel("back");
  expect(route()).toBe("map");
  expect(location.search).toBe("");
  await travel("back");
  expect(route()).toBe("catalog");
  expect(location.search).toBe("?pref=13&card=a");
  await travel("forward");
  await travel("forward");
  expect(route()).toBe("map");
  expect(location.search).toBe("?card=b");
  expect(within(shown()).getByRole("region", { name: "カードの詳細" }));
  expect(stage.created).toBe(1);
  // The data arrived once for both screens.
  expect(requests.filter((request) => request.includes("/data/"))).toEqual([
    "GET /data/full.json",
  ]);
});

it("opens a card's place on the kept map and returns focus on back", async () => {
  start("map", "/");
  await waitFor(() => expect(stage.current).not.toBeNull());
  await follow("一覧");
  await waitFor(() => expect(route()).toBe("catalog"));
  fireEvent.click(await screen.findByRole("button", { name: /東京都/ }));
  fireEvent.click(screen.getByRole("link", { name: /港区 b/ }));
  const link = within(shown()).getByRole("link", {
    name: "配布場所を地図で見る",
  });
  link.focus();
  await follow("配布場所を地図で見る");
  await waitFor(() => expect(route()).toBe("map"));
  expect(location.search).toBe("?card=b");
  await waitFor(() =>
    expect(stage.current!.selectedPins.map((pin) => pin.id)).toEqual(["p2"]),
  );
  await travel("back");
  expect(route()).toBe("catalog");
  expect(document.activeElement).toBe(link);
  expect(stage.created).toBe(1);
});

it("restores the map's search when back returns to it", async () => {
  start("map", "/");
  await waitFor(() => expect(stage.current).not.toBeNull());
  await follow("一覧");
  await waitFor(() => expect(route()).toBe("catalog"));
  fireEvent.click(await screen.findByRole("button", { name: /東京都/ }));
  await follow("地図");
  await waitFor(() => expect(route()).toBe("map"));
  fireEvent.click(screen.getByRole("button", { name: "カードを検索" }));
  const dialog = document.querySelector("dialog")!;
  expect(dialog.open).toBe(true);
  fireEvent.change(within(dialog).getByRole("searchbox"), {
    target: { value: "存在しない語" },
  });
  await follow("地域から探す");
  await waitFor(() => expect(route()).toBe("catalog"));
  // A link in the content names the regions, not the catalog as it was left.
  expect(location.pathname + location.search).toBe("/cards");
  // Left open, the modal would leave the catalog inert.
  expect(dialog.open).toBe(false);
  await travel("back");
  expect(route()).toBe("map");
  expect(dialog.open).toBe(true);
  expect(within(dialog).getByRole("searchbox")).toHaveProperty(
    "value",
    "存在しない語",
  );
});

it("leaves modified clicks, other pages and the screen shown to the browser", async () => {
  start("catalog", "/cards");
  await screen.findByRole("button", { name: /東京都/ });
  const header = within(shown()).getAllByRole("link", { name: "地図" })[0];
  for (const modifier of ["ctrlKey", "metaKey", "shiftKey", "altKey"]) {
    const event = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      [modifier]: true,
    });
    header.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  }
  const middle = new MouseEvent("click", {
    bubbles: true,
    cancelable: true,
    button: 1,
  });
  header.dispatchEvent(middle);
  expect(middle.defaultPrevented).toBe(false);
  for (const name of [/このサイトについて/, "一覧"]) {
    const event = new MouseEvent("click", { bubbles: true, cancelable: true });
    within(shown())
      .getAllByRole("link", { name, hidden: true })[0]
      .dispatchEvent(event);
    // An about link and the catalog's own link are documents as before.
    expect(event.defaultPrevented).toBe(false);
  }
  expect(route()).toBe("catalog");
  expect(stage.created).toBe(0);
});

it("follows the link as a document when the screen cannot be loaded", async () => {
  const fallback = vi.fn();
  start("catalog", "/cards", {
    load: () => Promise.reject(new Error("chunk")),
    fallback,
  });
  await screen.findByRole("button", { name: /東京都/ });
  expect((await follow("地図")).defaultPrevented).toBe(true);
  await waitFor(() => expect(fallback).toHaveBeenCalledWith(`${origin}/`));
  expect(route()).toBe("catalog");
  expect(location.pathname).toBe("/cards");
});

it("opens a working catalog from a map that failed to start", async () => {
  start("map", "/");
  await waitFor(() => expect(stage.current).not.toBeNull());
  act(() => stage.current!.onError("no WebGL"));
  await follow("一覧を開く");
  await waitFor(() => expect(route()).toBe("catalog"));
  fireEvent.click(await screen.findByRole("button", { name: /東京都/ }));
  expect(
    within(shown()).getByRole("link", { name: /千代田区 a/ }),
  ).toBeTruthy();
  expect(location.search).toBe("?pref=13");
});

it("shares one record load and shows a record saved in the catalog on the map", async () => {
  vi.stubEnv("VITE_ACCOUNTS_ENABLED", "true");
  document.cookie = "signed_in=1; Path=/";
  start("catalog", "/cards?pref=13&card=a");
  const receive = await screen.findByRole("button", { name: "回収した" });
  fireEvent.click(receive);
  await waitFor(() => expect(requests).toContain("PUT /api/me/records/a"));
  await follow("配布場所を地図で見る");
  await waitFor(() => expect(route()).toBe("map"));
  const detail = within(shown()).getByRole("region", { name: "カードの詳細" });
  await waitFor(() =>
    expect(
      within(detail).getByRole("button", { name: /^回収済み/ }),
    ).toBeTruthy(),
  );
  await follow("一覧");
  await waitFor(() => expect(route()).toBe("catalog"));
  await follow("地図");
  await waitFor(() => expect(route()).toBe("map"));
  expect(
    requests.filter((request) => request === "GET /api/me/records"),
  ).toHaveLength(1);
  expect(requests.filter((request) => request.includes("/data/"))).toEqual([
    "GET /data/full.json",
  ]);
});

it("reads no records and loads no records code while signed out", async () => {
  vi.stubEnv("VITE_ACCOUNTS_ENABLED", "true");
  start("catalog", "/cards");
  await screen.findByRole("button", { name: /東京都/ });
  await follow("地図");
  await waitFor(() => expect(route()).toBe("map"));
  expect(requests.filter((request) => request.includes("/api/"))).toEqual([]);
});

it("loads the records again for another user signed in elsewhere before a switch", async () => {
  vi.stubEnv("VITE_ACCOUNTS_ENABLED", "true");
  document.cookie = "signed_in=1; Path=/";
  document.cookie = "session_mark=a1; Path=/";
  start("catalog", "/cards?pref=13&card=a");
  await screen.findByRole("button", { name: /^回収済み/ });
  document.cookie = "session_mark=b2; Path=/";
  await follow("配布場所を地図で見る");
  await waitFor(() => expect(route()).toBe("map"));
  const detail = within(shown()).getByRole("region", { name: "カードの詳細" });
  await waitFor(() =>
    expect(
      within(detail).getAllByRole("button", { name: "回収した" }).length,
    ).toBeGreaterThan(0),
  );
  expect(
    within(detail).queryByRole("button", { name: /^回収済み/ }),
  ).toBeNull();
  expect(
    requests.filter((request) => request === "GET /api/me/records"),
  ).toHaveLength(2);
});

// As after a reload on the catalog: the map's entries are in the history,
// and back mounts the map for the first time.
it.each([
  [
    "its level and selection",
    { mapFocus: { area: "kanto", pref: "東京都" } },
    "/?card=b",
  ],
  [
    "its open search",
    { mapSearch: { phase: "search", query: "港区", limit: 50, scroll: 0 } },
    "/",
  ],
])(
  "first mounted by back, the map starts from its entry: %s",
  async (_name, state, url) => {
    history.replaceState(state, "", url);
    history.pushState(null, "", "/cards");
    start("catalog", "/cards");
    await screen.findByRole("button", { name: /東京都/ });
    await travel("back");
    await waitFor(() => expect(route()).toBe("map"));
    await waitFor(() => expect(stage.current).not.toBeNull());
    if ("mapFocus" in state) {
      expect(stage.current!.focus).toEqual(state.mapFocus);
      expect(stage.current!.selectedPins.map((pin) => pin.id)).toEqual(["p2"]);
    } else {
      const dialog = document.querySelector("dialog")!;
      expect(dialog.open).toBe(true);
      expect(within(dialog).getByRole("searchbox")).toHaveProperty(
        "value",
        "港区",
      );
    }
  },
);
