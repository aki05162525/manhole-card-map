import type { ComponentProps, ReactElement, ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, expect, it, vi } from "vitest";
import { createCardCatalog } from "./card-catalog";
import type { Data } from "./types";
import { searchSession } from "./map-search-state";
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
  useEffect: () => {},
  useLayoutEffect: () => {},
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
function render(overrides: Partial<Parameters<typeof MapSearch>[0]> = {}) {
  hooks.cursor = 0;
  return MapSearch({
    catalog,
    onSelect: vi.fn(),
    pref: "13",
    session: searchSession({ phase: "search", query: "観光" }),
    ...overrides,
  });
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
function control<T extends "button" | "input" | "dialog">(
  tree: ReactElement,
  type: T,
  label?: string,
) {
  return find(
    tree,
    (node) =>
      node.type === type &&
      (!label ||
        (node.props as Record<string, unknown>)["aria-label"] === label),
  )[0].props as ComponentProps<T>;
}
it("renders native nationwide results with facilities, status and pin reasons", () => {
  const html = renderToStaticMarkup(render());
  expect(html.match(/配布施設ピンなし/g)).toHaveLength(8);
  expect(html).toContain("配布施設の登録なし");
  expect(html).toContain("北海道・観光0");
  expect(html).toContain("/cards.html?pref=13");
  expect(html).not.toContain('role="option"');
  expect(html).not.toContain("一覧で全件見る");
});
it("query changes reset pagination and scroll, with no submit button", () => {
  const onUpdate = vi.fn();
  const tree = render({ onUpdate });
  control(tree, "input").onChange!({ target: { value: "三島" } } as never);
  expect(onUpdate).toHaveBeenCalledWith({
    query: "三島",
    limit: 50,
    scroll: 0,
    selected: null,
  });
  expect(find(tree, (node) => node.type === "form")).toHaveLength(0);
});
it("cancel always prevents DOM-only closure and calls history close", () => {
  const onClose = vi.fn(),
    preventDefault = vi.fn();
  control(render({ onClose }), "dialog").onCancel!({ preventDefault } as never);
  expect(preventDefault).toHaveBeenCalledOnce();
  expect(onClose).toHaveBeenCalledOnce();
});
it("reload uses parent retry and input remains editable after failure", () => {
  const onReload = vi.fn();
  const tree = render({ catalog: null, dataError: "取得失敗", onReload });
  const button = find(
    tree,
    (node) =>
      node.type === "button" &&
      (node.props as { children?: string }).children === "再読み込み",
  )[0];
  (button.props as ComponentProps<"button">).onClick!({} as never);
  expect(onReload).toHaveBeenCalledOnce();
  expect(control(tree, "input").disabled).toBeUndefined();
});
it("shows first fifty and explicitly adds fifty", () => {
  const large = createCardCatalog({
    ...data,
    cards: Array.from({ length: 58 }, (_, index) => ({
      ...data.cards[0],
      id: String(index),
    })),
  });
  const onUpdate = vi.fn();
  const tree = render({ catalog: large, onUpdate });
  expect(
    find(tree, (node) =>
      Boolean((node.props as Record<string, unknown>)["data-card"]),
    ),
  ).toHaveLength(50);
  const more = find(
    tree,
    (node) =>
      node.type === "button" &&
      (node.props as { children?: string }).children === "さらに50件表示",
  )[0];
  (more.props as ComponentProps<"button">).onClick!({} as never);
  expect(onUpdate).toHaveBeenCalledWith({ limit: 100 });
  expect(
    find(
      render({
        catalog: large,
        session: searchSession({ phase: "search", query: "観光", limit: 100 }),
      }),
      (node) => Boolean((node.props as Record<string, unknown>)["data-card"]),
    ),
  ).toHaveLength(58);
});
it("Enter moves focus to the heading without selecting; IME Enter stays in input", () => {
  const onSelect = vi.fn();
  const tree = render({ onSelect });
  const input = control(tree, "input");
  const blur = vi.fn(),
    focus = vi.fn(),
    preventDefault = vi.fn();
  (input.ref as { current: unknown }).current = { blur };
  const heading = find(tree, (node) => node.type === "h2")[0]
    .props as ComponentProps<"h2">;
  (heading.ref as { current: unknown }).current = { focus };
  input.onKeyDown!({
    key: "Enter",
    nativeEvent: { isComposing: true },
    preventDefault,
  } as never);
  expect(blur).not.toHaveBeenCalled();
  input.onKeyDown!({
    key: "Enter",
    nativeEvent: { isComposing: false },
    preventDefault,
  } as never);
  expect(blur).toHaveBeenCalledOnce();
  expect(focus).toHaveBeenCalledOnce();
  expect(onSelect).not.toHaveBeenCalled();
});
it("selection saves the row before handing an unpinned card to the parent", () => {
  const onSelect = vi.fn(),
    onUpdate = vi.fn();
  const tree = render({ onSelect, onUpdate });
  const row = find(
    tree,
    (node) =>
      (node.props as Record<string, unknown>)["data-card"] ===
      catalog.cards[0].id,
  )[0];
  (row.props as ComponentProps<"button">).onClick!({} as never);
  expect(onUpdate).toHaveBeenCalledWith({
    selected: catalog.cards[0].id,
    restore: true,
  });
  expect(onSelect).toHaveBeenCalledWith(catalog.cards[0]);
});
it("keeps typed text while loading or failed and renders the full empty-result guidance", () => {
  const session = searchSession({ phase: "search", query: "存在しない" });
  const loading = renderToStaticMarkup(render({ catalog: null, session }));
  expect(loading).toContain('value="存在しない"');
  expect(loading).toContain("カード情報を読み込み中です");
  const failed = renderToStaticMarkup(
    render({ catalog: null, dataError: "取得失敗", session }),
  );
  expect(failed).toContain('value="存在しない"');
  expect(failed).toContain("再読み込み");
  const loaded = renderToStaticMarkup(render({ session }));
  expect(loaded).toContain(
    "該当するカードはありません。自治体名・施設名・カード番号を変えてお試しください。",
  );
});
