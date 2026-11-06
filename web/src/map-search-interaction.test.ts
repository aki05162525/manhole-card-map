import type { ComponentProps, ReactElement, ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, expect, it, vi } from "vitest";
import { createCardCatalog } from "./card-catalog";
import type { Data } from "./types";
import { MapSearch } from "./map-search";

// Exercise rendered native controls with persistent local hook state, without a map or DOM runtime.
const hooks = vi.hoisted(() => ({ values: [] as unknown[], cursor: 0 }));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useState(initial: unknown) {
    const index = hooks.cursor++;
    if (!(index in hooks.values)) hooks.values[index] = initial;
    return [
      hooks.values[index],
      (value: unknown) => {
        hooks.values[index] = value;
      },
    ];
  },
  useRef: () => ({ current: null }),
  useMemo: (factory: () => unknown) => factory(),
  useId: () => "search-test",
}));
afterEach(() => {
  hooks.values = [];
  hooks.cursor = 0;
});
const data: Data = {
  schema: 1,
  updated: "",
  places: [],
  relations: [],
  pins: [],
  cards: Array.from({ length: 8 }, (_, i) => ({
    id: `01-00${i}-A001`,
    pref: "北海道",
    city: `観光${i}`,
    series: "",
    issued: "",
    acquired: "",
    status: "active",
    lid: { status: "unconfirmed" },
    placeText: null,
    hours: null,
    links: null,
  })),
};
const catalog = createCardCatalog(data);
function render(onSelect = vi.fn(), query = "観光", open = true) {
  if (!hooks.values.length) hooks.values = [query, open];
  hooks.cursor = 0;
  return MapSearch({ catalog, onSelect, pref: "13" });
}
function find(
  node: ReactNode,
  predicate: (element: ReactElement) => boolean,
): ReactElement[] {
  if (Array.isArray(node)) return node.flatMap((item) => find(item, predicate));
  if (!node || typeof node !== "object" || !("props" in node)) return [];
  const element = node as ReactElement<{ children?: ReactNode }>;
  return [
    ...(predicate(element) ? [element] : []),
    ...find(element.props.children, predicate),
  ];
}
function props<T extends "div" | "input" | "form" | "button">(
  tree: ReactElement,
  type: T,
  index = 0,
) {
  return find(tree, (node) => node.type === type)[index]
    .props as ComponentProps<T>;
}
it("renders five native result buttons with pin status and a nationwide full-results link", () => {
  const html = renderToStaticMarkup(render());
  expect(html.match(/配布施設ピンなし/g)).toHaveLength(5);
  expect(html).toContain("北海道");
  expect(html).toContain(data.cards[0].id);
  expect(html).not.toContain(data.cards[5].id);
  expect(html).toContain("/cards.html?pref=13");
  expect(html).toContain("/cards.html?q=%E8%A6%B3%E5%85%89");
  expect(html).toContain("8件。先頭5件");
  expect(html).not.toContain('role="option"');
});
it("Escape closes and focuses the input, and focus restoration does not reopen results", () => {
  const tree = render();
  const focus = vi.fn();
  const input = props(tree, "input");
  (input.ref as { current: unknown }).current = { focus };
  const preventDefault = vi.fn(),
    stopPropagation = vi.fn();
  const wrapper = find(tree, (node) =>
    Boolean((node.props as ComponentProps<"div">).onKeyDown),
  )[0];
  (wrapper.props as ComponentProps<"div">).onKeyDown!({
    key: "Escape",
    preventDefault,
    stopPropagation,
  } as unknown as Parameters<
    NonNullable<ComponentProps<"div">["onKeyDown"]>
  >[0]);
  expect(focus).toHaveBeenCalledOnce();
  expect(preventDefault).toHaveBeenCalledOnce();
  expect(stopPropagation).toHaveBeenCalledOnce();
  expect(props(render(), "input")["aria-expanded"]).toBe(false);
  expect(input.onFocus).toBeUndefined();
});
it("selection closes and blurs before delivering an unpinned card to the parent", () => {
  const onSelect = vi.fn();
  const tree = render(onSelect);
  const blurInput = vi.fn(),
    blurButton = vi.fn();
  (props(tree, "input").ref as { current: unknown }).current = {
    blur: blurInput,
  };
  const result = props(tree, "button", 1);
  expect(result.type).toBe("button");
  expect(result.tabIndex).toBeUndefined();
  result.onClick!({
    currentTarget: { blur: blurButton },
  } as unknown as Parameters<NonNullable<typeof result.onClick>>[0]);
  expect(blurInput).toHaveBeenCalledOnce();
  expect(blurButton).toHaveBeenCalledOnce();
  expect(onSelect).toHaveBeenCalledWith(data.cards[0]);
  expect(blurButton.mock.invocationCallOrder[0]).toBeLessThan(
    onSelect.mock.invocationCallOrder[0],
  );
  expect(props(render(), "input")["aria-expanded"]).toBe(false);
});
it("typing and Enter/search submit reopen results, but a blank submit never expands all cards", () => {
  const tree = render(vi.fn(), "", false);
  const preventDefault = vi.fn();
  props(tree, "form").onSubmit!({ preventDefault } as unknown as Parameters<
    NonNullable<ComponentProps<"form">["onSubmit"]>
  >[0]);
  expect(props(render(), "input")["aria-expanded"]).toBe(false);
  props(tree, "input").onChange!({
    target: { value: "観光" },
  } as unknown as Parameters<
    NonNullable<ComponentProps<"input">["onChange"]>
  >[0]);
  expect(props(render(), "input")["aria-expanded"]).toBe(true);
  hooks.values[1] = false;
  props(render(), "form").onSubmit!({ preventDefault } as unknown as Parameters<
    NonNullable<ComponentProps<"form">["onSubmit"]>
  >[0]);
  expect(props(render(), "input")["aria-expanded"]).toBe(true);
});
it("reload uses the parent's retry operation", () => {
  const onReload = vi.fn();
  const tree = MapSearch({
    catalog: null,
    dataError: "取得失敗",
    onSelect() {},
    onReload,
  });
  const button = props(tree, "button", 1);
  button.onClick!({} as Parameters<NonNullable<typeof button.onClick>>[0]);
  expect(onReload).toHaveBeenCalledOnce();
});
