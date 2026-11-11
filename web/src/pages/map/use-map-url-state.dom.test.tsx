import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { flushHistoryWrites } from "../../shared/browser/app-history";
import { useMapUrlState } from "./use-map-url-state";

const mapFocus = { area: "kanto", pref: "東京都" };
beforeEach(() => history.replaceState({ mapFocus, extra: "kept" }, "", "/"));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});
async function travel(direction: "back" | "forward") {
  await act(async () => {
    const restored = new Promise<void>((resolve) =>
      window.addEventListener("popstate", () => resolve(), { once: true }),
    );
    history[direction]();
    await restored;
  });
}
it("keeps bare / unselected, preserves mapFocus and restores selection on back/forward", async () => {
  const { result } = renderHook(() => useMapUrlState());
  expect(result.current.cardId).toBeNull();
  act(() => result.current.selectCard("13-001-A001"));
  expect(result.current.cardId).toBe("13-001-A001");
  expect(location.pathname + location.search).toBe("/?card=13-001-A001");
  expect(history.state).toMatchObject({
    mapFocus,
    extra: "kept",
    catalog: { card: "13-001-A001" },
  });
  const count = history.length;
  act(() => result.current.selectCard("13-001-A001"));
  expect(history.length).toBe(count);
  act(() => result.current.closeCard());
  await waitFor(() => expect(result.current.cardId).toBeNull());
  await travel("forward");
  expect(result.current.cardId).toBe("13-001-A001");
  expect(history.state.mapFocus).toEqual(mapFocus);
});
it("closes in one step after switching between several pins", async () => {
  const { result } = renderHook(() => useMapUrlState());
  const count = history.length;
  act(() => result.current.selectCard("13-001-A001"));
  act(() => result.current.selectCard("13-002-A001"));
  act(() => result.current.selectCard("13-003-A001"));
  expect(result.current.cardId).toBe("13-003-A001");
  expect(location.search).toBe("?card=13-003-A001");
  // Switching pins replaces the open detail instead of stacking entries.
  expect(history.length).toBe(count + 1);
  act(() => result.current.closeCard());
  await waitFor(() => expect(result.current.cardId).toBeNull());
  expect(location.search).toBe("");
  expect(history.state).toMatchObject({ mapFocus, extra: "kept" });
});
it("closes a direct URL with replace while preserving unrelated parameters and foreign history", () => {
  history.replaceState(
    {
      mapFocus,
      catalog: { card: "direct" },
      mapCardNavigation: { owner: "foreign", card: "direct" },
    },
    "",
    "/?card=direct&benchmark=1#anchor",
  );
  const { result } = renderHook(() => useMapUrlState());
  const back = vi.spyOn(history, "back");
  const count = history.length;
  expect(result.current.cardId).toBe("direct");
  act(() => result.current.closeCard());
  expect(back).not.toHaveBeenCalled();
  expect(history.length).toBe(count);
  expect(location.pathname + location.search + location.hash).toBe(
    "/?benchmark=1#anchor",
  );
  expect(history.state).toMatchObject({ mapFocus, catalog: { card: null } });
  expect(result.current.cardId).toBeNull();
});
it("validates shared URLs after data arrives and supplies recovery", () => {
  history.replaceState(null, "", "/?card=missing");
  const { result, rerender } = renderHook(
    (ids: ReadonlySet<string> | undefined) => useMapUrlState(ids),
    { initialProps: undefined as ReadonlySet<string> | undefined },
  );
  expect(result.current.cardId).toBe("missing");
  rerender(new Set(["known"]));
  expect(result.current).toMatchObject({
    cardId: null,
    issues: [{ field: "card", value: "missing" }],
  });
  act(() => result.current.closeCard());
  expect(result.current.issues).toEqual([]);
  expect(location.search).toBe("");
});
it("reads selection from URL rather than a stale catalog history value", () => {
  const { result } = renderHook(() => useMapUrlState());
  act(() => {
    history.pushState(
      { mapFocus, catalog: { card: "stale" } },
      "",
      "/?card=actual",
    );
    window.dispatchEvent(
      new PopStateEvent("popstate", { state: history.state }),
    );
  });
  expect(result.current.cardId).toBe("actual");
});
it("restores same-URL search sessions with back, forward and reselection", async () => {
  const { result } = renderHook(() => useMapUrlState());
  act(() => result.current.openSearch());
  expect(result.current.search.phase).toBe("search");
  expect(location.search).toBe("");
  act(() =>
    result.current.updateSearch({
      query: "三島",
      limit: 100,
      scroll: 240,
      selected: "id",
    }),
  );
  act(() => result.current.selectCard("id"));
  expect(result.current).toMatchObject({
    cardId: "id",
    search: { phase: "detail" },
  });
  act(() => result.current.openSearch());
  await waitFor(() => expect(result.current.search.phase).toBe("search"));
  expect(result.current).toMatchObject({
    cardId: null,
    search: {
      phase: "search",
      query: "三島",
      limit: 100,
      scroll: 240,
      selected: "id",
      restore: true,
    },
  });
  act(() => result.current.closeSearch());
  await waitFor(() => expect(result.current.search.phase).toBe("map"));
  expect(result.current.search.query).toBe("三島");
  await travel("forward");
  expect(result.current.search.phase).toBe("search");
  act(() => result.current.selectCard("id2"));
  expect(result.current.cardId).toBe("id2");
  expect(history.state).toMatchObject({ extra: "kept", mapFocus });
});
it("dismisses search detail with replace and retains a back route to search", async () => {
  const { result } = renderHook(() => useMapUrlState());
  act(() => result.current.openSearch());
  act(() => result.current.updateSearch({ query: "三島" }));
  act(() => result.current.selectCard("id"));
  const count = history.length;
  act(() => result.current.dismissCard());
  expect(history.length).toBe(count);
  expect(result.current).toMatchObject({
    cardId: null,
    search: { phase: "map", query: "三島" },
  });
  expect(location.search).toBe("");
  await travel("back");
  expect(result.current.search.phase).toBe("search");
});
it("cancels search over a direct detail without losing its URL", async () => {
  history.replaceState(
    { mapFocus, extra: 1 },
    "",
    "/?card=direct&other=1#hash",
  );
  const { result } = renderHook(() => useMapUrlState());
  act(() => result.current.openSearch());
  act(() => result.current.closeSearch());
  await waitFor(() => expect(result.current.search.phase).toBe("map"));
  expect(result.current.cardId).toBe("direct");
  expect(location.search + location.hash).toBe("?card=direct&other=1#hash");
});
it("selects the same card from search over a direct detail", () => {
  history.replaceState(null, "", "/?card=id");
  const { result } = renderHook(() => useMapUrlState());
  const push = vi.spyOn(history, "pushState");
  act(() => result.current.openSearch());
  act(() => result.current.selectCard("id"));
  expect(result.current.search.phase).toBe("detail");
  expect(push).toHaveBeenCalledTimes(2);
});
it("throttles history writes and flushes the latest query before navigation", () => {
  vi.useFakeTimers();
  const { result } = renderHook(() => useMapUrlState());
  act(() => result.current.openSearch());
  const replace = vi.spyOn(history, "replaceState");
  act(() => {
    for (let i = 0; i < 200; i++)
      result.current.updateSearch({ query: `語${i}` });
  });
  expect(result.current.search.query).toBe("語199");
  expect(replace).not.toHaveBeenCalled();
  act(() => vi.advanceTimersByTime(500));
  expect(replace).toHaveBeenCalledOnce();
  expect(history.state.mapSearch.query).toBe("語199");
  act(() =>
    result.current.updateSearch({ query: "三島", selected: "13-001-A001" }),
  );
  act(() => result.current.selectCard("13-001-A001"));
  expect(replace.mock.calls.at(-1)?.[0]).toMatchObject({
    mapSearch: { query: "三島", selected: "13-001-A001" },
  });
  expect(result.current.search.phase).toBe("detail");
});

it("keeps the friend when opening and dismissing a card", () => {
  vi.stubEnv("VITE_ACCOUNTS_ENABLED", "true");
  history.replaceState(null, "", "/?friend=f1");
  const { result } = renderHook(() => useMapUrlState());
  act(() => result.current.selectCard("card"));
  expect(new URLSearchParams(location.search).get("friend")).toBe("f1");
  act(() => result.current.dismissCard());
  expect(location.search).toBe("?friend=f1");
  vi.unstubAllEnvs();
});

// Another screen sharing the document, as the catalog will once both stay mounted.
function enterCatalogEntry(url = "/cards?pref=13") {
  history.pushState({ catalog: { card: null } }, "", url);
  window.dispatchEvent(new PopStateEvent("popstate", { state: history.state }));
}
it("drops a delayed search write once another screen's entry is current", () => {
  vi.useFakeTimers();
  const { result } = renderHook(() => useMapUrlState());
  act(() => result.current.openSearch());
  act(() => result.current.updateSearch({ query: "三島" }));
  history.pushState({ catalog: { card: null } }, "", "/cards?pref=13");
  act(() => vi.advanceTimersByTime(500));
  expect(history.state).toEqual({ catalog: { card: null } });
  expect(location.pathname + location.search).toBe("/cards?pref=13");
});
it("leaves another screen's entries and its own selection and search alone while they are current", async () => {
  const { result } = renderHook(() => useMapUrlState());
  act(() => result.current.openSearch());
  act(() => result.current.updateSearch({ query: "三島", selected: "id" }));
  act(() => result.current.selectCard("id"));
  const shown = { cardId: "id", search: { phase: "detail", query: "三島" } };
  act(() => enterCatalogEntry());
  expect(history.state).toEqual({ catalog: { card: null } });
  expect(result.current).toMatchObject(shown);
  act(() => history.pushState({ catalog: { card: "x" } }, "", "/cards?card=x"));
  await travel("back");
  expect(location.pathname + location.search).toBe("/cards?pref=13");
  expect(history.state).toEqual({ catalog: { card: null } });
  expect(result.current).toMatchObject(shown);
  // Actions of the screen that is not current must not reach the entry either.
  act(() => result.current.updateSearch({ query: "沼津" }));
  act(() => result.current.dismissCard());
  expect(history.state).toEqual({ catalog: { card: null } });
  expect(location.pathname + location.search).toBe("/cards?pref=13");
  await travel("back");
  expect(location.search).toBe("?card=id");
  expect(result.current).toMatchObject({
    cardId: "id",
    search: { phase: "detail" },
  });
});
it("closes only its own detail when the entry behind it belongs to another screen", () => {
  const { result } = renderHook(() => useMapUrlState());
  act(() => result.current.selectCard("id"));
  const { mapCardNavigation } = history.state;
  history.pushState({ catalog: { card: null } }, "", "/cards");
  // The map's mark arrives on an entry reached from the catalog.
  act(() => {
    history.pushState({ mapCardNavigation }, "", "/?card=id");
    window.dispatchEvent(
      new PopStateEvent("popstate", { state: history.state }),
    );
  });
  const back = vi.spyOn(history, "back");
  const count = history.length;
  act(() => result.current.closeCard());
  expect(back).not.toHaveBeenCalled();
  expect(history.length).toBe(count);
  expect(location.pathname + location.search).toBe("/");
  expect(result.current.cardId).toBeNull();
});
it("closes only its own search when the entry behind it belongs to another screen", () => {
  const { result } = renderHook(() => useMapUrlState());
  act(() => result.current.openSearch());
  const { mapSearch } = history.state;
  history.pushState({ catalog: { card: null } }, "", "/cards");
  act(() => {
    history.pushState({ mapSearch }, "", "/");
    window.dispatchEvent(
      new PopStateEvent("popstate", { state: history.state }),
    );
  });
  expect(result.current.search.phase).toBe("search");
  const back = vi.spyOn(history, "back");
  act(() => result.current.closeSearch());
  expect(back).not.toHaveBeenCalled();
  expect(result.current.search.phase).toBe("map");
  expect(location.pathname).toBe("/");
});
it("commits a waiting search write at once when the screen is about to be left", () => {
  vi.useFakeTimers();
  const { result } = renderHook(() => useMapUrlState());
  act(() => result.current.openSearch());
  act(() => result.current.updateSearch({ query: "三島" }));
  flushHistoryWrites();
  expect(history.state.mapSearch.query).toBe("三島");
  history.pushState({ catalog: { card: null } }, "", "/cards");
  act(() => vi.advanceTimersByTime(500));
  expect(history.state).toEqual({ catalog: { card: null } });
});
