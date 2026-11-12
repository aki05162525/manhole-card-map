import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { useEffect, type ComponentProps, type ComponentType } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { Data } from "../domain/types";
import type { MapStage } from "../features/map/map-stage";
import { screenMeta } from "./document-meta";

// Each test is a new document: the history layer, the shared data and the
// screens keep their state for the life of one.
let App: typeof import("./app").App;
type Route = import("../shared/browser/app-history").HistoryRoute;
let screens: Record<Route, ComponentType>;

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
const meta = {
  map: screenMeta.map(2),
  catalog: screenMeta.catalog(2),
  friends: screenMeta.friends(2),
  account: screenMeta.account(2),
};
const requests: string[] = [];
// The API's other answers, by method and path, for the test that sets them.
const answers = new Map<string, () => Response | Promise<Response>>();
const json = (body: unknown) => new Response(JSON.stringify(body));
let scroll = 0;
const scrolled = vi.fn((_x: number, y: number) => (scroll = y));

function head(route: Route) {
  const { title, url } = meta[route];
  document.title = title;
  document.head.innerHTML = `<link rel="canonical" href="${url}"><meta property="og:url" content="${url}"><meta name="description" content=""><meta name="viewport" content="">`;
}
function start(
  route: Route,
  url: string,
  props: Partial<ComponentProps<typeof App>> = {},
) {
  history.replaceState(null, "", url);
  head(route);
  return render(
    <App
      initial={route}
      screens={{ [route]: screens[route] }}
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
  screens = {
    map: (await import("./map-screen")).default,
    catalog: (await import("./catalog-screen")).default,
    friends: (await import("./friends-screen")).default,
    account: (await import("./account-screen")).default,
  };
  stage.current = null;
  stage.created = stage.removed = 0;
  requests.length = 0;
  answers.clear();
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
      const answer = answers.get(`${init?.method ?? "GET"} ${url}`);
      if (answer) return answer();
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

it("lets a position that arrives behind the catalog leave the map alone", async () => {
  let found: PositionCallback | undefined;
  vi.stubGlobal("navigator", {
    ...navigator,
    geolocation: {
      getCurrentPosition: (success: PositionCallback) => (found = success),
    },
  });
  start("map", "/");
  await waitFor(() => expect(stage.current).not.toBeNull());
  const adapter = { locate: vi.fn(), select: vi.fn(), focus: vi.fn() };
  act(() =>
    stage.current!.onReady(
      adapter as unknown as Parameters<
        NonNullable<typeof stage.current>["onReady"]
      >[0],
    ),
  );
  fireEvent.click(within(shown()).getByRole("button", { name: "現在地" }));
  expect(found).toBeDefined();
  await follow("一覧");
  await waitFor(() => expect(route()).toBe("catalog"));
  act(() =>
    found!({ coords: { latitude: 35, longitude: 139 } } as GeolocationPosition),
  );
  expect(adapter.locate).not.toHaveBeenCalled();
  await follow("地図");
  await waitFor(() => expect(route()).toBe("map"));
  // Not stuck waiting: the button asks again.
  expect(
    within(shown())
      .getByRole("button", { name: "現在地" })
      .hasAttribute("disabled"),
  ).toBe(false);
  expect(adapter.locate).not.toHaveBeenCalled();
});

const signIn = (mark: string) => {
  document.cookie = "signed_in=1; Path=/";
  document.cookie = `session_mark=${mark}; Path=/`;
};
const signOut = () => {
  document.cookie = "signed_in=; Max-Age=0; Path=/";
  document.cookie = "session_mark=; Max-Age=0; Path=/";
};
/** Passkeys as a browser that has them; every prompt succeeds. */
function passkeys() {
  vi.stubGlobal("PublicKeyCredential", {
    parseCreationOptionsFromJSON: (options: unknown) => options,
    parseRequestOptionsFromJSON: (options: unknown) => options,
  });
  vi.stubGlobal("navigator", {
    ...navigator,
    userAgent: navigator.userAgent,
    credentials: {
      create: async () => ({ toJSON: () => ({ id: "new" }) }),
      get: async () => ({ toJSON: () => ({ id: "old" }) }),
    },
  });
}
const pinIds = () => stage.current!.pins.map((pin) => pin.id);
/** The map has drawn: what the records wait for. */
async function mapReady() {
  await waitFor(() => expect(stage.current).not.toBeNull());
  const adapter = { locate: vi.fn(), select: vi.fn(), focus: vi.fn() };
  act(() =>
    stage.current!.onReady(
      adapter as unknown as Parameters<
        NonNullable<typeof stage.current>["onReady"]
      >[0],
    ),
  );
}
const friendRecords = (name: string, cardId: string) => () =>
  json({
    displayName: name,
    count: 1,
    records: [{ cardId, receivedOn: "2026-11-01" }],
  });

it("shows each friend's records on the one kept map, fetched again on every visit", async () => {
  vi.stubEnv("VITE_ACCOUNTS_ENABLED", "true");
  signIn("a1");
  answers.set("GET /api/friends", () =>
    json({
      friends: [
        { userId: "A", displayName: "あき", count: 1, since: 0 },
        { userId: "B", displayName: "ゆう", count: 1, since: 0 },
      ],
      requests: [],
      blocks: [],
      invite: { expiresAt: null },
    }),
  );
  answers.set("GET /api/friends/A/records", friendRecords("あき", "a"));
  let answerB: (response: Response) => void = () => {};
  answers.set(
    "GET /api/friends/B/records",
    () => new Promise<Response>((resolve) => (answerB = resolve)),
  );
  start("friends", "/friends");
  await screen.findAllByRole("link", { name: "回収マップを見る" });
  await follow("回収マップを見る");
  await waitFor(() => expect(route()).toBe("map"));
  expect(location.search).toBe("?friend=A");
  await mapReady();
  await within(shown()).findByText(/あきさんの回収マップ/);
  await waitFor(() => expect(pinIds()).toEqual(["p1"]));

  await travel("back");
  expect(route()).toBe("friends");
  const links = await within(shown()).findAllByRole("link", {
    name: "回収マップを見る",
  });
  act(() => {
    links[1].dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true }),
    );
  });
  await waitFor(() => expect(route()).toBe("map"));
  expect(location.search).toBe("?friend=B");
  // Until B's answer, nothing of A's remains.
  await within(shown()).findByText(/フレンドの記録を読み込み中/);
  expect(within(shown()).queryByText(/あきさん/)).toBeNull();
  expect(pinIds()).toEqual(["p1", "p2"]);
  await act(async () => answerB(friendRecords("ゆう", "b")()));
  await within(shown()).findByText(/ゆうさんの回収マップ/);
  expect(pinIds()).toEqual(["p2"]);

  // The site's own link to the map opens the user's own.
  await follow("地図");
  await waitFor(() => expect(location.search).toBe(""));
  expect(route()).toBe("map");
  await waitFor(() =>
    expect(within(shown()).queryByText(/ゆうさん/)).toBeNull(),
  );
  await waitFor(() => expect(requests).toContain("GET /api/me/records"));
  expect(pinIds()).toEqual(["p1"].concat("p2"));
  // Back to B's map asks again: a removal since would show nothing.
  answers.set(
    "GET /api/friends/B/records",
    () => new Response(null, { status: 404 }),
  );
  await travel("back");
  expect(location.search).toBe("?friend=B");
  await within(shown()).findByText(/表示できません/);
  expect(pinIds()).toEqual(["p1", "p2"]);
  expect(
    requests.filter((request) => request.startsWith("GET /api/friends/")),
  ).toEqual([
    "GET /api/friends/A/records",
    "GET /api/friends/B/records",
    "GET /api/friends/B/records",
  ]);
  expect(
    requests.filter((request) => request === "GET /api/friends"),
  ).toHaveLength(2);
  expect(stage.created).toBe(1);
  expect(stage.removed).toBe(0);
});

it("forgets an account screen left halfway, recovery codes included", async () => {
  vi.stubEnv("VITE_ACCOUNTS_ENABLED", "true");
  passkeys();
  answers.set("POST /api/auth/register/options", () =>
    json({ challenge: "c" }),
  );
  answers.set("POST /api/auth/register/verify", () => {
    signIn("a1");
    return json({ recoveryCodes: ["AAAA-BBBB-CCCC-0001"] });
  });
  answers.set("GET /api/account", () =>
    json({
      profile: {
        displayName: "たろう",
        passkeys: 1,
        recoveryCodesRemaining: 10,
      },
      passkeys: [],
    }),
  );
  start("account", "/account");
  fireEvent.click(
    await screen.findByRole("button", { name: "回復コードで入る" }),
  );
  fireEvent.change(screen.getByLabelText("回復コード"), {
    target: { value: "aaaa-bbbb" },
  });
  await follow("地図");
  await waitFor(() => expect(route()).toBe("map"));
  await follow("ログイン");
  await waitFor(() => expect(route()).toBe("account"));
  expect(
    within(shown()).getByRole("heading", { level: 1, name: "ログイン" }),
  ).toBeTruthy();
  expect(within(shown()).queryByLabelText("回復コード")).toBeNull();

  fireEvent.change(within(shown()).getByLabelText("表示名"), {
    target: { value: "たろう" },
  });
  fireEvent.click(
    within(shown()).getByRole("button", { name: "パスキーを作る" }),
  );
  await within(shown()).findByRole("list", { name: "回復コード" });
  await follow("地図");
  await waitFor(() => expect(route()).toBe("map"));
  // Registered, the map's menu offers the account now.
  await follow("アカウント");
  await waitFor(() => expect(route()).toBe("account"));
  await within(shown()).findByRole("heading", { level: 1, name: "アカウント" });
  expect(
    within(shown()).queryByRole("list", { name: "回復コード" }),
  ).toBeNull();
  expect(document.body.textContent).not.toContain("AAAA-BBBB-CCCC-0001");
  expect(stage.created).toBe(1);
});

it("returns to the card after signing in, with the records, and drops them on logout", async () => {
  vi.stubEnv("VITE_ACCOUNTS_ENABLED", "true");
  passkeys();
  answers.set("POST /api/auth/login/options", () => json({ challenge: "c" }));
  answers.set("POST /api/auth/login/verify", () => {
    signIn("a1");
    return json({});
  });
  answers.set("GET /api/account", () =>
    json({
      profile: {
        displayName: "たろう",
        passkeys: 1,
        recoveryCodesRemaining: 10,
      },
      passkeys: [],
    }),
  );
  answers.set("POST /api/auth/logout", () => {
    signOut();
    return json({});
  });
  start("map", "/?card=a");
  await mapReady();
  await follow("ログインして記録");
  await waitFor(() => expect(route()).toBe("account"));
  expect(new URLSearchParams(location.search).get("returnTo")).toBe("/?card=a");
  fireEvent.click(
    within(shown()).getByRole("button", { name: "パスキーでログイン" }),
  );
  await waitFor(() => expect(route()).toBe("map"));
  expect(location.pathname + location.search).toBe("/?card=a");
  const detail = within(shown()).getByRole("region", { name: "カードの詳細" });
  await waitFor(() =>
    expect(
      within(detail).getByRole("button", { name: /^回収済み/ }),
    ).toBeTruthy(),
  );
  expect(
    within(shown()).getAllByRole("link", { name: "アカウント", hidden: true })
      .length,
  ).toBeGreaterThan(0);
  expect(
    within(shown()).queryAllByRole("link", { name: "ログイン", hidden: true }),
  ).toEqual([]);

  await follow("アカウント");
  await waitFor(() => expect(route()).toBe("account"));
  fireEvent.click(
    await within(shown()).findByRole("button", { name: "ログアウト" }),
  );
  await within(shown()).findByRole("heading", { level: 1, name: "ログイン" });
  await follow("地図");
  await waitFor(() => expect(route()).toBe("map"));
  await within(shown()).findAllByRole("link", { name: "ログインして記録" });
  expect(
    within(shown()).queryByRole("button", { name: /^回収済み/ }),
  ).toBeNull();
  expect(
    within(shown()).getAllByRole("link", { name: "ログイン", hidden: true })
      .length,
  ).toBeGreaterThan(0);
  expect(
    requests.filter((request) => request === "GET /api/me/records"),
  ).toHaveLength(1);
  expect(stage.created).toBe(1);
  expect(stage.removed).toBe(0);
});

it("asks the private API nothing while signed out across friends and the account", async () => {
  vi.stubEnv("VITE_ACCOUNTS_ENABLED", "true");
  start("map", "/");
  await waitFor(() => expect(stage.current).not.toBeNull());
  await follow("フレンド");
  await waitFor(() => expect(route()).toBe("friends"));
  await follow("ログイン・登録へ");
  await waitFor(() => expect(route()).toBe("account"));
  expect(location.search).toBe("?returnTo=%2Ffriends");
  await follow("地図");
  await waitFor(() => expect(route()).toBe("map"));
  expect(requests.filter((request) => request.includes("/api/"))).toEqual([]);
});

it.each([
  ["the recovery step", "/account?recover"],
  ["an invitation", "/friends/invite"],
  ["a link for LINE", "/account?openExternalBrowser=1"],
  ["a friend's map for LINE", "/?friend=A&openExternalBrowser=1"],
])("leaves %s to the browser", async (_name, href) => {
  vi.stubEnv("VITE_ACCOUNTS_ENABLED", "true");
  start("catalog", "/cards");
  await screen.findByRole("button", { name: /東京都/ });
  const link = document.createElement("a");
  link.href = href;
  shown().append(link);
  const event = new MouseEvent("click", { bubbles: true, cancelable: true });
  link.dispatchEvent(event);
  expect(event.defaultPrevented).toBe(false);
});

it("leaves the account and friends to the browser inside LINE", async () => {
  vi.stubEnv("VITE_ACCOUNTS_ENABLED", "true");
  vi.stubGlobal("navigator", {
    ...navigator,
    userAgent: "Mozilla/5.0 (iPhone) Line/14.0.0",
  });
  start("catalog", "/cards");
  await screen.findByRole("button", { name: /東京都/ });
  for (const name of ["フレンド", "ログイン"])
    expect((await follow(name)).defaultPrevented).toBe(false);
  expect((await follow("地図")).defaultPrevented).toBe(true);
});

it("follows the link as a document when the screen shown throws", async () => {
  const fallback = vi.fn();
  vi.spyOn(console, "error").mockImplementation(() => {});
  start("catalog", "/cards", {
    load: async () => () => {
      throw new Error("render");
    },
    fallback,
  });
  await screen.findByRole("button", { name: /東京都/ });
  await follow("地図");
  await waitFor(() => expect(fallback).toHaveBeenCalledWith(`${origin}/`));
});

// A passkey prompt left open when the account is left: it may still finish.
it.each([
  ["回復コードを再発行", "再発行する", "POST /api/recovery-codes"],
  ["アカウントを削除", "削除する", "DELETE /api/me"],
])(
  "sends nothing more once the account is left during the check before %s",
  async (button, confirm, request) => {
    vi.stubEnv("VITE_ACCOUNTS_ENABLED", "true");
    signIn("a1");
    let finish: (credential: unknown) => void = () => {};
    let signal: AbortSignal | undefined;
    vi.stubGlobal("PublicKeyCredential", {
      parseRequestOptionsFromJSON: (options: unknown) => options,
    });
    vi.stubGlobal("navigator", {
      ...navigator,
      credentials: {
        get: (options: { signal?: AbortSignal }) => {
          signal = options.signal;
          return new Promise((resolve) => (finish = resolve));
        },
      },
    });
    answers.set("GET /api/account", () =>
      json({
        profile: {
          displayName: "たろう",
          passkeys: 1,
          recoveryCodesRemaining: 10,
        },
        passkeys: [],
      }),
    );
    const [method, path] = request.split(" ");
    answers.set(`${method} ${path}`, () =>
      requests.filter((sent) => sent === request).length > 1
        ? json({ recoveryCodes: ["NEW-CODE"] })
        : new Response(JSON.stringify({ error: "reauth_required" }), {
            status: 403,
          }),
    );
    answers.set("POST /api/auth/reauth/options", () =>
      json({ challenge: "c" }),
    );
    answers.set("POST /api/auth/reauth/verify", () => json({ ok: true }));
    start("account", "/account");
    // The settings have loaded: their buttons wait while they load.
    await screen.findByRole("button", { name: "回復コードを再発行" });
    await waitFor(() =>
      expect(
        screen.getByRole<HTMLButtonElement>("button", { name: button })
          .disabled,
      ).toBe(false),
    );
    fireEvent.click(screen.getByRole("button", { name: button }));
    fireEvent.click(
      within(document.querySelector<HTMLElement>("dialog[open]")!).getByRole(
        "button",
        { name: confirm },
      ),
    );
    await waitFor(() =>
      expect(requests).toContain("POST /api/auth/reauth/options"),
    );
    await waitFor(() => expect(signal).toBeDefined());
    await follow("地図");
    await waitFor(() => expect(route()).toBe("map"));
    expect(signal!.aborted).toBe(true);
    await act(async () => finish({ toJSON: () => ({ id: "old" }) }));
    await act(async () => {});
    expect(requests).not.toContain("POST /api/auth/reauth/verify");
    expect(requests.filter((sent) => sent === request)).toHaveLength(1);
  },
);

it("keeps a new session when the friends' answer for the one before is a 401", async () => {
  vi.stubEnv("VITE_ACCOUNTS_ENABLED", "true");
  signIn("a1");
  let answer: (response: Response) => void = () => {};
  answers.set(
    "GET /api/friends",
    () => new Promise<Response>((resolve) => (answer = resolve)),
  );
  answers.set("GET /api/account", () =>
    json({
      profile: {
        displayName: "たろう",
        passkeys: 1,
        recoveryCodesRemaining: 10,
      },
      passkeys: [],
    }),
  );
  start("friends", "/friends");
  await waitFor(() => expect(requests).toContain("GET /api/friends"));
  await follow("アカウント");
  await waitFor(() => expect(route()).toBe("account"));
  // Signed in again as someone else before the old answer came.
  signIn("b2");
  await act(async () =>
    answer(
      new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 }),
    ),
  );
  await act(async () => {});
  expect(document.cookie).toContain("signed_in=1");
  expect(document.cookie).toContain("session_mark=b2");
});

const friendsPage =
  (...names: string[]) =>
  () =>
    json({
      friends: names.map((displayName, index) => ({
        userId: `u${index}`,
        displayName,
        count: 1,
        since: 0,
      })),
      requests: [],
      blocks: [],
      invite: { expiresAt: Date.UTC(2026, 10, 20) },
    });
const settingsPage = (displayName: string) => () =>
  json({
    profile: { displayName, passkeys: 1, recoveryCodesRemaining: 10 },
    passkeys: [],
  });
/** A reply held until the test lets it go. */
function held() {
  let release: (response: Response) => void = () => {};
  const reply = () => new Promise<Response>((resolve) => (release = resolve));
  return { reply, release: (response: Response) => release(response) };
}

it("shows the friends read before at once on a return and swaps in the fresh read", async () => {
  vi.stubEnv("VITE_ACCOUNTS_ENABLED", "true");
  signIn("a1");
  answers.set("GET /api/friends", friendsPage("あき"));
  answers.set("POST /api/invite", () =>
    json({ url: "https://example.test/friends/invite#t=secret", expiresAt: 1 }),
  );
  start("map", "/");
  await mapReady();
  await follow("フレンド");
  await waitFor(() => expect(route()).toBe("friends"));
  await within(shown()).findByText("あき");
  fireEvent.click(within(shown()).getByRole("button", { name: "作り直す" }));
  fireEvent.click(
    within(document.querySelector<HTMLElement>("dialog[open]")!).getByRole(
      "button",
      { name: "作り直す" },
    ),
  );
  const link = () => document.querySelector<HTMLInputElement>("#invite-url");
  await waitFor(() => expect(link()?.value).toContain("t=secret"));
  await follow("地図");
  await waitFor(() => expect(route()).toBe("map"));

  const fresh = held();
  answers.set("GET /api/friends", fresh.reply);
  await follow("フレンド");
  await waitFor(() => expect(route()).toBe("friends"));
  // Drawn from memory: no wait, no loading line.
  expect(within(shown()).getByText("あき")).toBeTruthy();
  expect(document.body.textContent).not.toContain("読み込み中");
  // The invitation's link is never kept.
  expect(link()).toBeNull();
  await act(async () => fresh.release(friendsPage("あき", "ゆう")()));
  await within(shown()).findByText("ゆう");
});

it("shows the account's settings read before at once on a return and swaps in the fresh read", async () => {
  vi.stubEnv("VITE_ACCOUNTS_ENABLED", "true");
  signIn("a1");
  answers.set("GET /api/account", settingsPage("たろう"));
  start("map", "/");
  await mapReady();
  await follow("アカウント");
  await waitFor(() => expect(route()).toBe("account"));
  await waitFor(() =>
    expect(within(shown()).getByLabelText("表示名")).toHaveProperty(
      "value",
      "たろう",
    ),
  );
  await follow("地図");
  await waitFor(() => expect(route()).toBe("map"));
  const fresh = held();
  answers.set("GET /api/account", fresh.reply);
  await follow("アカウント");
  await waitFor(() => expect(route()).toBe("account"));
  expect(within(shown()).getByLabelText("表示名")).toHaveProperty(
    "value",
    "たろう",
  );
  expect(within(shown()).getByText("10")).toBeTruthy();
  await act(async () => fresh.release(settingsPage("じろう")()));
  await waitFor(() =>
    expect(within(shown()).getByLabelText("表示名")).toHaveProperty(
      "value",
      "じろう",
    ),
  );
  expect(
    requests.filter((request) => request === "GET /api/account"),
  ).toHaveLength(2);
});

it.each([
  ["another user signed in", () => signIn("b2")],
  ["a logout", () => signOut()],
])(
  "keeps nothing read before for the next screen after %s",
  async (_name, change) => {
    vi.stubEnv("VITE_ACCOUNTS_ENABLED", "true");
    signIn("a1");
    answers.set("GET /api/friends", friendsPage("あき"));
    start("map", "/");
    await mapReady();
    await follow("フレンド");
    await waitFor(() => expect(route()).toBe("friends"));
    await within(shown()).findByText("あき");
    await follow("地図");
    await waitFor(() => expect(route()).toBe("map"));
    change();
    const fresh = held();
    answers.set("GET /api/friends", fresh.reply);
    await follow("フレンド");
    await waitFor(() => expect(route()).toBe("friends"));
    expect(within(shown()).queryByText("あき")).toBeNull();
    await act(async () => fresh.release(friendsPage("ゆう")()));
    if (document.cookie.includes("signed_in=1")) {
      await within(shown()).findByText("ゆう");
      expect(
        requests.filter((request) => request === "GET /api/friends"),
      ).toHaveLength(2);
    } else
      expect(
        requests.filter((request) => request === "GET /api/friends"),
      ).toHaveLength(1);
  },
);

it("starts reading the friends and the account when the menu opens, and only once", async () => {
  vi.stubEnv("VITE_ACCOUNTS_ENABLED", "true");
  signIn("a1");
  answers.set("GET /api/friends", friendsPage("あき"));
  answers.set("GET /api/account", settingsPage("たろう"));
  start("map", "/");
  await mapReady();
  fireEvent.click(within(shown()).getByRole("button", { name: "メニュー" }));
  await waitFor(() =>
    expect(requests).toEqual(
      expect.arrayContaining(["GET /api/friends", "GET /api/account"]),
    ),
  );
  await follow("フレンド");
  await waitFor(() => expect(route()).toBe("friends"));
  await within(shown()).findByText("あき");
  await follow("アカウント");
  await waitFor(() => expect(route()).toBe("account"));
  await within(shown()).findByLabelText("表示名");
  expect(
    requests.filter((request) => request === "GET /api/friends"),
  ).toHaveLength(1);
  expect(
    requests.filter((request) => request === "GET /api/account"),
  ).toHaveLength(1);
});

it("reads nothing private when the menu opens while signed out", async () => {
  vi.stubEnv("VITE_ACCOUNTS_ENABLED", "true");
  start("map", "/");
  await mapReady();
  fireEvent.click(within(shown()).getByRole("button", { name: "メニュー" }));
  const link = within(shown()).getAllByRole("link", { name: "フレンド" })[0];
  fireEvent.pointerDown(link);
  fireEvent.focus(link);
  await act(async () => {});
  expect(requests.filter((request) => request.includes("/api/"))).toEqual([]);
});
