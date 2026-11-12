import type { HistoryRoute } from "../shared/browser/app-history";

/** What a screen's head says about it: shared links and search engines. */
export type DocumentMeta = {
  title: string;
  description: string;
  url: string;
  viewport: string;
};

const site = "https://manhole-techo.com";
/**
 * The heads of `index.html` and `cards.html`, for the screen whose document
 * this is not; `document-meta.test.ts` holds them equal. The map counts the
 * cards the build ships.
 */
export const screenMeta: Record<
  HistoryRoute,
  (cardCount: number) => DocumentMeta
> = {
  map: (cardCount) => ({
    title: "マンホールカード地図｜全国の配布場所マップ - マンホール手帳",
    description: `全国${cardCount}枚のマンホールカードの配布場所を地図で探せる非公式マップ。自治体名・施設名・カード番号で検索し、配布時間や条件、蓋の場所まで確認できます。`,
    url: `${site}/`,
    viewport: "width=device-width,initial-scale=1,viewport-fit=cover",
  }),
  catalog: () => ({
    title: "マンホールカード一覧｜都道府県別の配布場所 - マンホール手帳",
    description:
      "都道府県・自治体ごとにマンホールカードの配布場所を一覧で確認できます。自治体名・施設名・カード番号で検索し、配布施設の情報や地図への経路を探せます。",
    url: `${site}/cards`,
    viewport: "width=device-width,initial-scale=1",
  }),
};

const head = (selector: string) =>
  document.head.querySelector<HTMLMetaElement | HTMLLinkElement>(selector);
const fields = {
  description: ['meta[name="description"]', 'meta[property="og:description"]'],
  url: ['link[rel="canonical"]', 'meta[property="og:url"]'],
  title: ['meta[property="og:title"]'],
  viewport: ['meta[name="viewport"]'],
} as const;

/** The head the document arrived with. */
export function readDocumentMeta(): DocumentMeta {
  const value = (selector: string) => {
    const element = head(selector);
    return element instanceof HTMLLinkElement
      ? element.href
      : (element?.content ?? "");
  };
  return {
    title: document.title,
    description: value(fields.description[0]),
    url: value(fields.url[0]),
    viewport: value(fields.viewport[0]),
  };
}
export function applyDocumentMeta(meta: DocumentMeta) {
  document.title = meta.title;
  for (const key of Object.keys(fields) as (keyof typeof fields)[])
    for (const selector of fields[key]) {
      const element = head(selector);
      if (element instanceof HTMLLinkElement) element.href = meta[key];
      else if (element) element.content = meta[key];
    }
}
