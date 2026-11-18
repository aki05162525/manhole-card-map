import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Traversal } from "./app-history";

// The module keeps the entries it has seen, so each test loads it afresh. The
// copy listens to popstate for good: what it added is removed after the test.
let appHistory: typeof import("./app-history");
let loaded: AbortController;
beforeEach(async () => {
  history.replaceState(null, "", "/");
  vi.resetModules();
  loaded = new AbortController();
  const { signal } = loaded;
  const listen = window.addEventListener.bind(window);
  vi.spyOn(window, "addEventListener").mockImplementation(
    (type, listener, options) =>
      listen(type, listener, {
        ...(typeof options === "object"
          ? options
          : { capture: options === true }),
        signal,
      }),
  );
  appHistory = await import("./app-history");
});
afterEach(async () => {
  vi.useRealTimers();
  loaded.abort();
  vi.mocked(window.addEventListener).mockRestore();
  // A fragment move tells of itself later: not during the next test.
  await new Promise((resolve) => setTimeout(resolve));
});

const href = (path: string) => new URL(path, location.href).href;
const path = () => location.pathname + location.search + location.hash;
/** A back or forward move, heard as the browser tells it: later. */
async function travel(delta: number) {
  const moved = new Promise((resolve) =>
    window.addEventListener("popstate", resolve, { once: true }),
  );
  history.go(delta);
  await moved;
}

it.each([
  ["/", "map"],
  ["/index.html", "map"],
  ["/cards", "catalog"],
  ["/cards.html", "catalog"],
  ["/friends", "friends"],
  ["/friends.html", "friends"],
  ["/account", "account"],
  ["/account.html", "account"],
  ["/about", "about"],
  ["/about.html", "about"],
  ["/cards/", null],
  ["/card/13-101-A001/", null],
  ["/pref/13/cards", null],
  ["/friends/invite", null],
  ["/invite/friends", null],
  ["/accounts", null],
  ["/my/account", null],
  ["/about/data", null],
  ["/terms/about", null],
  ["/terms", null],
])("reads the screen of %s as %s", (pathname, route) => {
  expect(appHistory.historyRoute(pathname)).toBe(route);
});

describe("a screen's own entries", () => {
  it("gives the entry an id on the first write and keeps it over replaces", () => {
    const map = appHistory.routeHistory("map");
    expect(appHistory.currentEntryId()).toBeNull();
    expect(map.replace({ level: 1 })).toBe(true);
    const id = appHistory.currentEntryId();
    expect(id).toEqual(expect.any(String));
    expect(map.replace({ level: 2 }, "/?card=a")).toBe(true);
    expect(appHistory.currentEntryId()).toBe(id);
    expect(path()).toBe("/?card=a");
    expect(map.state()).toMatchObject({ level: 2 });
    // Nothing of this screen lies behind an entry it only replaced.
    expect(map.back()).toBe(false);
  });

  it("pushes an entry that back() returns from", async () => {
    const map = appHistory.routeHistory("map");
    map.replace({ level: 1 });
    const first = appHistory.currentEntryId();
    expect(map.push({ level: 2 }, "/?card=a")).toBe(true);
    expect(path()).toBe("/?card=a");
    expect(appHistory.currentEntryId()).not.toBe(first);
    const arrived = new Promise((resolve) =>
      window.addEventListener("popstate", resolve, { once: true }),
    );
    expect(map.back()).toBe(true);
    await arrived;
    expect(path()).toBe("/");
    expect(appHistory.currentEntryId()).toBe(first);
    expect(map.state()).toMatchObject({ level: 1 });
  });

  it("neither reads nor writes while another screen's entry is current", () => {
    history.replaceState({ kept: true }, "", "/cards?pref=13");
    const map = appHistory.routeHistory("map");
    expect(map.owns()).toBe(false);
    expect(map.state()).toBeNull();
    expect(map.push({ level: 1 }, "/?card=a")).toBe(false);
    expect(map.replace({ level: 1 })).toBe(false);
    expect(path()).toBe("/cards?pref=13");
    expect(history.state).toEqual({ kept: true });
    expect(appHistory.routeHistory("catalog").state()).toEqual({ kept: true });
  });

  it.each([
    ["names another screen", { route: "catalog", id: "stored", from: "map" }],
    ["has no id", { route: "map", from: "map" }],
    ["is not an object", "stored"],
  ])("takes an entry as unmarked when its stored mark %s", (_, appEntry) => {
    history.replaceState({ appEntry }, "", "/");
    expect(appHistory.currentEntryId()).toBeNull();
    expect(appHistory.routeHistory("map").back()).toBe(false);
  });

  it("does not carry a stored mark's unknown screen behind over a replace", () => {
    history.replaceState(
      { appEntry: { route: "map", id: "stored", from: "private-marker" } },
      "",
      "/",
    );
    appHistory.routeHistory("map").replace({});
    expect(history.state).toEqual({
      appEntry: { route: "map", id: "stored", from: null },
    });
  });
});

describe("a switch between screens", () => {
  it("leaves for a new entry of the other screen and returns the entry left", async () => {
    history.replaceState({ level: 1 }, "", "/?card=a");
    const catalog = appHistory.routeHistory("catalog");
    const heard = vi.fn();
    catalog.subscribe(heard);
    const left = appHistory.switchScreen({
      from: "map",
      to: "catalog",
      url: "/cards?pref=13",
      state: { catalog: { card: null } },
    });
    expect(path()).toBe("/cards?pref=13");
    expect(catalog.state()).toMatchObject({ catalog: { card: null } });
    expect(heard).toHaveBeenCalledTimes(1);
    // The entry behind is the map's: the list has nowhere of its own to go back to.
    expect(catalog.back()).toBe(false);
    expect(left).toEqual({
      route: "map",
      id: expect.any(String),
      url: href("/?card=a"),
      state: expect.objectContaining({ level: 1 }),
    });
    await travel(-1);
    expect(path()).toBe("/?card=a");
    expect(appHistory.currentEntryId()).toBe(left!.id);
    expect(appHistory.routeHistory("map").state()).toMatchObject({ level: 1 });
  });

  it("commits the delayed writes to the entry left", async () => {
    history.replaceState({ level: 1 }, "", "/");
    const write = appHistory
      .routeHistory("map")
      .deferred(100, (state, search: string) => ({
        ...(state as object),
        search,
      }));
    write.set(() => "a");
    const left = appHistory.switchScreen({
      from: "map",
      to: "catalog",
      url: "/cards",
      state: {},
    });
    expect(left?.state).toMatchObject({ level: 1, search: "a" });
    expect(write.pending).toBeNull();
    await travel(-1);
    expect(history.state).toMatchObject({ level: 1, search: "a" });
  });

  it("keeps the id the entry left already had", () => {
    appHistory.routeHistory("map").replace({ level: 1 });
    const id = appHistory.currentEntryId();
    const left = appHistory.switchScreen({
      from: "map",
      to: "about",
      url: "/about",
      state: {},
    });
    expect(left?.id).toBe(id);
  });

  it.each([
    [
      "another screen's entry is current",
      "/cards",
      { from: "map", to: "about", url: "/about" },
    ],
    [
      "the URL names another screen",
      "/",
      { from: "map", to: "catalog", url: "/about" },
    ],
    [
      "the URL is on another origin",
      "/",
      { from: "map", to: "catalog", url: "https://other.example/cards" },
    ],
    [
      "the URL is the one shown",
      "/?friend=a",
      { from: "map", to: "map", url: "/?friend=a" },
    ],
  ] as const)("refuses when %s", (_, start, move) => {
    history.replaceState({ kept: true }, "", start);
    const entries = history.length;
    const heard = vi.fn();
    appHistory.routeHistory(move.to).subscribe(heard);
    expect(appHistory.switchScreen({ ...move, state: {} })).toBeNull();
    expect(path()).toBe(start);
    expect(history.state).toEqual({ kept: true });
    expect(history.length).toBe(entries);
    expect(heard).not.toHaveBeenCalled();
  });

  it("tells the same screen of another view of it at another URL", () => {
    const map = appHistory.routeHistory("map");
    const heard = vi.fn();
    map.subscribe(heard);
    const left = appHistory.switchScreen({
      from: "map",
      to: "map",
      url: "/?friend=a",
      state: {},
    });
    expect(left?.url).toBe(href("/"));
    expect(path()).toBe("/?friend=a");
    expect(heard).toHaveBeenCalledTimes(1);
  });

  it("tells a screen of a return only when its entry is not as it was left", () => {
    history.replaceState({ level: 1 }, "", "/");
    const heard = vi.fn();
    appHistory.routeHistory("map").subscribe(heard);
    const away = () =>
      appHistory.switchScreen({
        from: "map",
        to: "catalog",
        url: "/cards",
        state: {},
      });
    const back = (url: string, state: unknown) =>
      appHistory.switchScreen({ from: "catalog", to: "map", url, state });
    away();
    back("/", { level: 1 });
    expect(heard).not.toHaveBeenCalled();
    away();
    back("/", { level: 2 });
    expect(heard).toHaveBeenCalledTimes(1);
    away();
    back("/?card=a", { level: 2 });
    expect(heard).toHaveBeenCalledTimes(2);
  });
});

describe("a back or forward move", () => {
  it("is told once to the listeners of the screen whose entry it lands on", async () => {
    const map = vi.fn();
    const catalog = vi.fn();
    appHistory.routeHistory("map").subscribe(map);
    appHistory.routeHistory("catalog").subscribe(catalog);
    appHistory.switchScreen({
      from: "map",
      to: "catalog",
      url: "/cards",
      state: {},
    });
    catalog.mockClear();
    await travel(-1);
    expect(map).toHaveBeenCalledTimes(1);
    expect(catalog).not.toHaveBeenCalled();
    await travel(1);
    expect(map).toHaveBeenCalledTimes(1);
    expect(catalog).toHaveBeenCalledTimes(1);
  });

  it("is not told to a listener removed before it, even by an earlier listener", async () => {
    const map = appHistory.routeHistory("map");
    map.push({}, "/?card=a");
    let removeLater = () => {};
    const earlier = vi.fn(() => removeLater());
    const later = vi.fn();
    map.subscribe(earlier);
    removeLater = map.subscribe(later);
    await travel(-1);
    expect(earlier).toHaveBeenCalledTimes(1);
    expect(later).not.toHaveBeenCalled();
    await travel(1);
    expect(earlier).toHaveBeenCalledTimes(2);
    expect(later).not.toHaveBeenCalled();
  });

  it("goes to the traversal handler first, with the entry left, and it decides when the screen hears", async () => {
    const handler = vi.fn<(arrival: Traversal) => void>();
    appHistory.onTraversal(handler);
    const map = appHistory.routeHistory("map");
    const heard = vi.fn();
    map.subscribe(heard);
    map.push({ level: 2 }, "/?card=a");
    const pushed = appHistory.currentEntryId();
    await travel(-1);
    expect(handler).toHaveBeenCalledTimes(1);
    const [arrival] = handler.mock.calls[0];
    expect(arrival.route).toBe("map");
    expect(arrival.left).toEqual({
      route: "map",
      id: pushed,
      url: href("/?card=a"),
      state: expect.objectContaining({ level: 2 }),
    });
    expect(heard).not.toHaveBeenCalled();
    arrival.arrive();
    expect(heard).toHaveBeenCalledTimes(1);
  });

  it("knows the entry left by the first move after the document loaded", async () => {
    // As a document loaded at the list, with the map's entry behind it.
    history.pushState({ loaded: true }, "", "/cards?pref=13");
    const handler = vi.fn();
    appHistory.onTraversal(handler);
    await travel(-1);
    expect(handler.mock.calls).toEqual([
      [
        {
          route: "map",
          left: {
            route: "catalog",
            id: null,
            url: href("/cards?pref=13"),
            state: { loaded: true },
          },
          arrive: expect.any(Function),
        },
      ],
    ]);
  });

  it("is not told to a screen once another screen's entry is current", async () => {
    const handler = vi.fn<(arrival: Traversal) => void>();
    appHistory.onTraversal(handler);
    const heard = vi.fn();
    appHistory.routeHistory("map").subscribe(heard);
    appHistory.switchScreen({
      from: "map",
      to: "catalog",
      url: "/cards",
      state: {},
    });
    await travel(-1);
    await travel(1);
    const [toMap, toCatalog] = handler.mock.calls.map(([arrival]) => arrival);
    expect(toMap.left?.url).toBe(href("/cards"));
    expect(toCatalog.left?.url).toBe(href("/"));
    // The map's arrival, held back until the visitor had moved on.
    toMap.arrive();
    expect(heard).not.toHaveBeenCalled();
  });

  it("stops going to a traversal handler once removed, not to the one that replaced it", async () => {
    const map = appHistory.routeHistory("map");
    map.push({}, "/?card=a");
    map.push({}, "/?card=b");
    const heard = vi.fn();
    map.subscribe(heard);
    const first = vi.fn();
    const second = vi.fn();
    const removeFirst = appHistory.onTraversal(first);
    const removeSecond = appHistory.onTraversal(second);
    removeFirst();
    await travel(-1);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
    expect(heard).not.toHaveBeenCalled();
    removeSecond();
    await travel(-1);
    expect(second).toHaveBeenCalledTimes(1);
    expect(heard).toHaveBeenCalledTimes(1);
  });
});

describe("the entry a screen showed last", () => {
  it("is null until the screen has been current", () => {
    history.replaceState({ level: 1 }, "", "/?card=a");
    expect(appHistory.latestEntry("catalog")).toBeNull();
    expect(appHistory.latestEntry("map")).toEqual({
      route: "map",
      id: null,
      url: href("/?card=a"),
      state: { level: 1 },
    });
  });

  it("is the entry as back and forward moves and the screen's writes left it", async () => {
    const map = appHistory.routeHistory("map");
    expect(appHistory.latestEntry("map")?.url).toBe(href("/"));
    history.pushState(null, "", "/?card=a");
    history.pushState(null, "", "/cards");
    await travel(-1);
    await travel(1);
    expect(appHistory.latestEntry("map")?.url).toBe(href("/?card=a"));
    await travel(-1);
    map.replace({ level: 3 }, "/?card=b");
    appHistory.switchScreen({
      from: "map",
      to: "about",
      url: "/about",
      state: {},
    });
    expect(appHistory.latestEntry("map")).toMatchObject({
      url: href("/?card=b"),
      state: { level: 3 },
    });
  });

  it("follows back and forward moves from the first switch on", async () => {
    history.pushState(null, "", "/?card=a");
    appHistory.switchScreen({
      from: "map",
      to: "catalog",
      url: "/cards",
      state: {},
    });
    await travel(-2);
    await travel(2);
    expect(path()).toBe("/cards");
    expect(appHistory.latestEntry("map")?.url).toBe(href("/"));
  });
});

describe("a deferred write", () => {
  const merge = (state: unknown, search: string) => ({
    ...(state as object),
    search,
  });
  beforeEach(() => {
    vi.useFakeTimers();
    history.replaceState({ kept: true }, "", "/");
  });

  it("commits what the sets left waiting, once the delay has passed", () => {
    const commit = vi.fn(merge);
    const write = appHistory.routeHistory("map").deferred(100, commit);
    expect(write.pending).toBeNull();
    write.set(() => "a");
    write.set((waiting) => `${waiting}b`);
    expect(write.pending).toBe("ab");
    vi.advanceTimersByTime(99);
    expect(history.state).toEqual({ kept: true });
    vi.advanceTimersByTime(1);
    expect(history.state).toMatchObject({ kept: true, search: "ab" });
    expect(write.pending).toBeNull();
    expect(commit).toHaveBeenCalledTimes(1);
  });

  it("commits at once when flushed, and not again when the delay passes", () => {
    const map = appHistory.routeHistory("map");
    const commit = vi.fn(merge);
    const write = map.deferred(100, commit);
    const other = map.deferred(100, (state, level: number) => ({
      ...(state as object),
      level,
    }));
    write.set(() => "a");
    other.set(() => 2);
    appHistory.flushHistoryWrites();
    expect(history.state).toMatchObject({ kept: true, search: "a", level: 2 });
    expect(write.pending).toBeNull();
    vi.advanceTimersByTime(100);
    expect(commit).toHaveBeenCalledTimes(1);
  });

  it("drops what is waiting when cancelled", () => {
    const commit = vi.fn(merge);
    const write = appHistory.routeHistory("map").deferred(100, commit);
    write.set(() => "a");
    write.cancel();
    expect(write.pending).toBeNull();
    vi.advanceTimersByTime(100);
    expect(commit).not.toHaveBeenCalled();
  });

  it("commits a write set again after a cancel in the order of that set", () => {
    const map = appHistory.routeHistory("map");
    const commit = (_: unknown, level: number) => ({ level });
    const first = map.deferred(500, commit);
    const second = map.deferred(500, commit);
    first.set(() => 0);
    first.cancel();
    second.set(() => 1);
    first.set(() => 2);
    appHistory.flushHistoryWrites();
    // The write set last is the one that stays.
    expect(history.state).toMatchObject({ level: 2 });
  });

  it("ignores a set while another screen's entry is current", () => {
    history.replaceState({ kept: true }, "", "/cards");
    const write = appHistory.routeHistory("map").deferred(100, merge);
    const next = vi.fn(() => "a");
    write.set(next);
    expect(next).not.toHaveBeenCalled();
    expect(write.pending).toBeNull();
  });

  it("commits to an entry with an id, also one given after the set", () => {
    const map = appHistory.routeHistory("map");
    const write = map.deferred(100, merge);
    write.set(() => "a");
    map.replace({ level: 1 });
    vi.advanceTimersByTime(100);
    expect(history.state).toMatchObject({ level: 1, search: "a" });
    write.set(() => "b");
    vi.advanceTimersByTime(100);
    expect(history.state).toMatchObject({ level: 1, search: "b" });
  });

  it("is dropped once the screen has pushed another entry", () => {
    const map = appHistory.routeHistory("map");
    const commit = vi.fn(merge);
    const write = map.deferred(100, commit);
    write.set(() => "a");
    map.push({}, "/?card=a");
    // What waited for the entry left does not reach the next set either.
    const next = vi.fn(() => "b");
    write.set(next);
    expect(next).toHaveBeenCalledWith(null);
    write.cancel();
    write.set(() => "a");
    map.push({}, "/?card=b");
    vi.advanceTimersByTime(100);
    expect(commit).not.toHaveBeenCalled();
  });

  it("is dropped once the visitor has gone back from the entry", async () => {
    vi.useRealTimers();
    // Neither entry carries an id.
    history.pushState(null, "", "/?card=a");
    const commit = vi.fn(merge);
    const write = appHistory.routeHistory("map").deferred(100, commit);
    write.set(() => "a");
    await travel(-1);
    write.flush();
    expect(commit).not.toHaveBeenCalled();
    expect(history.state).toEqual({ kept: true });
  });

  it("is dropped even when the visitor has returned to the entry", async () => {
    vi.useRealTimers();
    const map = appHistory.routeHistory("map");
    const commit = vi.fn(merge);
    const write = map.deferred(100, commit);
    write.set(() => "a");
    map.push({}, "/?card=a");
    await travel(-1);
    write.flush();
    expect(commit).not.toHaveBeenCalled();
  });

  it("is not committed to an entry that a fragment link added", () => {
    const map = appHistory.routeHistory("map");
    map.replace({ level: 1 });
    const commit = vi.fn(merge);
    const write = map.deferred(100, commit);
    write.set(() => "a");
    location.hash = "#legend";
    write.flush();
    expect(commit).not.toHaveBeenCalled();
  });
});

describe("a move the page makes by itself", () => {
  it("goes to the navigation handler, and on to the document when it declines", () => {
    const handler = vi.fn(() => true);
    const remove = appHistory.onNavigate(handler);
    appHistory.navigate("#taken");
    expect(handler.mock.calls).toEqual([["#taken"]]);
    expect(location.hash).toBe("");
    handler.mockReturnValue(false);
    appHistory.navigate("#declined");
    expect(location.hash).toBe("#declined");
    remove();
    appHistory.navigate("#unheard");
    expect(handler).toHaveBeenCalledTimes(2);
    expect(location.hash).toBe("#unheard");
  });

  it("replaces the current entry when leaving as a redirect would", () => {
    const entries = history.length;
    appHistory.replaceDocument("#moved");
    expect(location.hash).toBe("#moved");
    expect(history.length).toBe(entries);
    appHistory.navigate("#on");
    expect(history.length).toBe(entries + 1);
  });

  it("keeps the handler that replaced a removed one", () => {
    const first = vi.fn(() => true);
    const second = vi.fn(() => true);
    const removeFirst = appHistory.onNavigate(first);
    appHistory.onNavigate(second);
    removeFirst();
    appHistory.navigate("#taken");
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
    expect(location.hash).toBe("");
  });
});
