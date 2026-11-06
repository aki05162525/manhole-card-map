import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useMapUrlState } from "./use-map-url-state";

const hooks = vi.hoisted(() => ({
  values: [] as unknown[],
  cursor: 0,
  effect: null as null | (() => void),
}));
vi.mock("react", () => ({
  useState(initial: () => unknown) {
    const index = hooks.cursor++;
    if (!(index in hooks.values)) hooks.values[index] = initial();
    return [
      hooks.values[index],
      (value: unknown) => {
        hooks.values[index] = value;
      },
    ];
  },
  useRef(initial: unknown) {
    const index = hooks.cursor++;
    if (!(index in hooks.values)) hooks.values[index] = { current: initial };
    return hooks.values[index];
  },
  useMemo: (factory: () => unknown) => factory(),
  useCallback: (callback: unknown) => callback,
  useEffect(effect: () => () => void) {
    hooks.effect ??= effect();
  },
}));
let target: EventTarget;
let entries: { url: string; state: unknown }[];
let position: number;
const mapFocus = { area: "kanto", pref: "東京都" };
function render(ids?: ReadonlySet<string>) {
  hooks.cursor = 0;
  return useMapUrlState(ids);
}
function navigate(url: string, state: unknown) {
  entries = [{ url: `https://example.com${url}`, state }];
  position = 0;
}
beforeEach(() => {
  target = new EventTarget();
  navigate("/", { mapFocus, extra: "kept" });
  vi.stubGlobal("window", {
    get location() {
      return { href: entries[position].url };
    },
    addEventListener: target.addEventListener.bind(target),
    removeEventListener: target.removeEventListener.bind(target),
  });
  vi.stubGlobal("history", {
    get state() {
      return entries[position].state;
    },
    pushState(state: unknown, _title: string, url: string) {
      entries.splice(position + 1);
      entries.push({ state, url: new URL(url, entries[position].url).href });
      position++;
    },
    replaceState(state: unknown, _title: string, url: string) {
      entries[position] = {
        state,
        url: new URL(url, entries[position].url).href,
      };
    },
    back: vi.fn(() => {
      if (position) position--;
      target.dispatchEvent(new Event("popstate"));
    }),
    forward() {
      if (position + 1 < entries.length) position++;
      target.dispatchEvent(new Event("popstate"));
    },
  });
});
afterEach(() => {
  hooks.effect?.();
  hooks.effect = null;
  hooks.values = [];
  hooks.cursor = 0;
  vi.unstubAllGlobals();
});
it("keeps bare / unselected and preserves mapFocus across selection and popstate", () => {
  expect(render().cardId).toBeNull();
  render().selectCard("13-001-A001");
  expect(render().cardId).toBe("13-001-A001");
  expect(
    new URL(entries[position].url).pathname +
      new URL(entries[position].url).search,
  ).toBe("/?card=13-001-A001");
  expect(history.state).toMatchObject({
    mapFocus,
    extra: "kept",
    catalog: { card: "13-001-A001" },
  });
  render().selectCard("13-001-A001");
  expect(entries).toHaveLength(2);
  render().closeCard();
  expect(history.back).toHaveBeenCalledOnce();
  expect(render().cardId).toBeNull();
  history.forward();
  expect(render().cardId).toBe("13-001-A001");
  expect(history.state.mapFocus).toEqual(mapFocus);
});
it("direct URL close removes only card with replaceState and preserves foreign history", () => {
  navigate("/?card=01-231-B001&benchmark=1#anchor", {
    mapFocus,
    catalog: { card: "01-231-B001" },
    mapCardNavigation: { owner: "foreign", card: "01-231-B001" },
  });
  expect(render().cardId).toBe("01-231-B001");
  render().closeCard();
  expect(entries).toHaveLength(1);
  expect(history.back).not.toHaveBeenCalled();
  expect(entries[0].url).toBe("https://example.com/?benchmark=1#anchor");
  expect(history.state).toMatchObject({ mapFocus, catalog: { card: null } });
  expect(render().cardId).toBeNull();
});
it("validates shared URLs after data arrives and supplies a recovery operation", () => {
  navigate("/?card=missing", null);
  expect(render().cardId).toBe("missing");
  expect(render(new Set(["known"]))).toMatchObject({
    cardId: null,
    issues: [{ field: "card", value: "missing" }],
  });
  render().closeCard();
  expect(render().issues).toEqual([]);
  expect(entries[0].url).toBe("https://example.com/");
});
it("restores selection from URL, independently of a stale catalog history value", () => {
  render();
  history.pushState(
    { mapFocus, catalog: { card: "stale" } },
    "",
    "/?card=actual",
  );
  target.dispatchEvent(new Event("popstate"));
  expect(render().cardId).toBe("actual");
});
