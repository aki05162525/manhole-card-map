import { prefectures } from "../../prefectures";

export type CatalogUrlState = {
  pref: string | null;
  q: string;
  page: number;
  card: string | null;
};
export type CatalogUrlIssue = {
  field: "pref" | "q" | "page" | "card";
  value: string;
  message: string;
};
export type CatalogUrlResult = CatalogUrlState & { issues: CatalogUrlIssue[] };
export type CatalogUrlValidation = {
  cardIds?: ReadonlySet<string> | undefined;
  totalPages?: number;
};
type UrlInput = string | URL | URLSearchParams;
function parameters(input: UrlInput): URLSearchParams {
  if (input instanceof URLSearchParams) return new URLSearchParams(input);
  if (input instanceof URL) return new URLSearchParams(input.search);
  return new URL(input, "https://catalog.invalid/").searchParams;
}
const prefCodes = new Set([...prefectures.map((pref) => pref.code), "other"]);
export function readCatalogUrl(
  input: UrlInput,
  validation: CatalogUrlValidation = {},
): CatalogUrlResult {
  const params = parameters(input);
  const issues: CatalogUrlIssue[] = [];
  function value(field: CatalogUrlIssue["field"]): string | null {
    if (params.getAll(field).length > 1)
      issues.push({
        field,
        value: params.getAll(field).join(", "),
        message: "同じ項目が複数指定されています。先頭の値を使います。",
      });
    return params.get(field);
  }
  let pref = value("pref");
  if (pref !== null && !prefCodes.has(pref)) {
    issues.push({
      field: "pref",
      value: pref,
      message: "指定された県は登録されていません。全国へ戻れます。",
    });
    pref = null;
  }
  const q = (value("q") ?? "").trim();
  const rawPage = value("page");
  let page = rawPage === null ? 1 : Number(rawPage);
  if (
    (rawPage !== null && !/^[1-9]\d*$/.test(rawPage)) ||
    !Number.isSafeInteger(page) ||
    page < 1 ||
    (validation.totalPages !== undefined &&
      page > Math.max(1, validation.totalPages))
  ) {
    issues.push({
      field: "page",
      value: rawPage ?? "",
      message: "指定されたページはありません。先頭ページへ戻れます。",
    });
    page = 1;
  }
  let card = value("card");
  if (
    card !== null &&
    (!card.trim() || (validation.cardIds && !validation.cardIds.has(card)))
  ) {
    issues.push({
      field: "card",
      value: card,
      message: "指定されたカードは見つかりません。詳細を閉じて一覧へ戻れます。",
    });
    card = null;
  }
  return { pref, q, page, card, issues };
}
export function catalogUrl(state: CatalogUrlState): string {
  const params = new URLSearchParams();
  if (state.pref) params.set("pref", state.pref);
  if (state.q.trim()) params.set("q", state.q.trim());
  if (state.page !== 1) params.set("page", String(state.page));
  if (state.card) params.set("card", state.card);
  const query = params.toString();
  return `/cards${query ? `?${query}` : ""}`;
}
export function mapCardUrl(card: string): string {
  return `/?${new URLSearchParams({ card })}`;
}
export function readMapCardUrl(
  input: UrlInput,
  cardIds?: ReadonlySet<string>,
): { card: string | null; issues: CatalogUrlIssue[] } {
  const params = parameters(input);
  const onlyCard = new URLSearchParams();
  for (const card of params.getAll("card")) onlyCard.append("card", card);
  const result = readCatalogUrl(onlyCard, { cardIds });
  return { card: result.card, issues: result.issues };
}
export type CatalogHistoryState = { card: string | null };
/** The caller decides push/replace/back. Never overwrite mapFocus or other owners. */
export function mergeCatalogHistoryState(
  state: unknown,
  catalog: CatalogHistoryState,
): Record<string, unknown> & { catalog: CatalogHistoryState } {
  return {
    ...(state && typeof state === "object" ? state : {}),
    catalog: { ...catalog },
  };
}
