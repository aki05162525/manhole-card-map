import { readCatalogSummary } from "../domain/catalog-summary";
import {
  CATALOG_HEAD,
  otherPrefecturePage,
  prefectureListHead,
  prefecturePages,
} from "../domain/prefecture-pages";
import type { HistoryRoute } from "../shared/browser/app-history";
import { catalogUrl, readCatalogUrl } from "../shared/url/catalog-url";

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
 * `friends.html`, `account.html`, `about.html`), for a document that is
 * another screen's;
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
    ...CATALOG_HEAD,
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
  about: () => ({
    title: "マンホール手帳について｜マンホールカード地図の使い方",
    description:
      "マンホールカードの配布場所を地図と一覧で探せるマンホール手帳。カードの探し方、配布施設から蓋を訪ねる使い方、データの出典を紹介します。",
    url: `${site}/about`,
    viewport,
    robots: null,
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

/**
 * The list's head while it shows one prefecture, or null for the whole
 * list: the head of that prefecture's own HTML (`/pref/<slug>/`,
 * `pages/cards/static-catalog.tsx`; `document-meta.dom.test.tsx` holds them
 * equal). The prefecture is the one the URL names unless given. Its count is
 * the build's, which only a document that started as the list carries on
 * its root; elsewhere the description leaves it out.
 */
export function prefectureMeta(
  pref = readCatalogUrl(location.href).pref,
): DocumentMeta | null {
  const page = [...prefecturePages, otherPrefecturePage].find(
    (page) => page.code === pref,
  );
  if (!page) return null;
  const totals = readCatalogSummary(
    document.getElementById("root")?.dataset ?? {},
  )?.totals;
  return {
    ...prefectureListHead(page.name, totals?.[page.code]),
    url: site + catalogUrl({ pref: page.code, q: "", page: 1, card: null }),
    viewport,
    robots: null,
  };
}

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
