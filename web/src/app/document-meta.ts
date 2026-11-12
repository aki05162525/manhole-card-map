import type { HistoryRoute } from "../shared/browser/app-history";

/**
 * What a screen's head says about it: shared links and search engines.
 * A null field is one the screen's HTML leaves out; the social tags go with
 * the canonical URL.
 */
export type DocumentMeta = {
  title: string;
  description: string | null;
  url: string | null;
  viewport: string;
  robots: string | null;
};

const site = "https://manhole-techo.com";
const viewport = "width=device-width,initial-scale=1";
/**
 * The heads of the screens' own HTML (`index.html`, `cards.html`,
 * `friends.html`, `account.html`), for a document that is another screen's;
 * `document-meta.dom.test.tsx` holds them equal. The map counts the cards the
 * build ships.
 */
export const screenMeta: Record<
  HistoryRoute,
  (cardCount: number) => DocumentMeta
> = {
  map: (cardCount) => ({
    title: "マンホールカード地図｜全国の配布場所マップ - マンホール手帳",
    description: `全国${cardCount}枚のマンホールカードの配布場所を地図で探せる非公式マップ。自治体名・施設名・カード番号で検索し、配布時間や条件、蓋の場所まで確認できます。`,
    url: `${site}/`,
    viewport: `${viewport},viewport-fit=cover`,
    robots: null,
  }),
  catalog: () => ({
    title: "マンホールカード一覧｜都道府県別の配布場所 - マンホール手帳",
    description:
      "都道府県・自治体ごとにマンホールカードの配布場所を一覧で確認できます。自治体名・施設名・カード番号で検索し、配布施設の情報や地図への経路を探せます。",
    url: `${site}/cards`,
    viewport,
    robots: null,
  }),
  friends: () => ({
    title: "フレンド | マンホール手帳",
    description: null,
    url: null,
    viewport,
    robots: "noindex",
  }),
  account: () => ({
    title: "アカウント | マンホール手帳",
    description:
      "マンホール手帳のアカウント。パスキーでログインし、受け取ったマンホールカードを記録できます。",
    url: `${site}/account`,
    viewport,
    robots: "noindex",
  }),
};

// Each tag of the head a screen sets, and how to make it when it is missing.
const fields: [
  tag: "meta" | "link",
  key: string,
  name: string,
  value: (meta: DocumentMeta) => string | null,
][] = [
  ["meta", "name", "description", (meta) => meta.description],
  ["meta", "property", "og:description", (m) => m.url && m.description],
  ["link", "rel", "canonical", (meta) => meta.url],
  ["meta", "property", "og:url", (meta) => meta.url],
  ["meta", "property", "og:title", (meta) => meta.url && meta.title],
  ["meta", "name", "viewport", (meta) => meta.viewport],
  ["meta", "name", "robots", (meta) => meta.robots],
];
const find = (tag: string, key: string, name: string) =>
  document.head.querySelector<HTMLMetaElement | HTMLLinkElement>(
    `${tag}[${key}="${name}"]`,
  );
const read = (tag: string, key: string, name: string) => {
  const element = find(tag, key, name);
  return element instanceof HTMLLinkElement
    ? element.href
    : (element?.content ?? null);
};

/** The head the document arrived with. */
export function readDocumentMeta(): DocumentMeta {
  return {
    title: document.title,
    description: read("meta", "name", "description"),
    url: read("link", "rel", "canonical"),
    viewport: read("meta", "name", "viewport") ?? "",
    robots: read("meta", "name", "robots"),
  };
}
export function applyDocumentMeta(meta: DocumentMeta) {
  document.title = meta.title;
  for (const [tag, key, name, value] of fields) {
    const next = value(meta);
    let element = find(tag, key, name);
    if (next === null) {
      element?.remove();
      continue;
    }
    if (!element) {
      element = document.createElement(tag);
      element.setAttribute(key, name);
      document.head.append(element);
    }
    if (element instanceof HTMLLinkElement) element.href = next;
    else element.content = next;
  }
}
