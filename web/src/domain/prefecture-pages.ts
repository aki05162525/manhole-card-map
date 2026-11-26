import { prefectures } from "../prefectures";

// JIS prefecture-code order. Kept separate from the generated geographic master.
const slugs =
  "hokkaido aomori iwate miyagi akita yamagata fukushima ibaraki tochigi gunma saitama chiba tokyo kanagawa niigata toyama ishikawa fukui yamanashi nagano gifu shizuoka aichi mie shiga kyoto osaka hyogo nara wakayama tottori shimane okayama hiroshima yamaguchi tokushima kagawa ehime kochi fukuoka saga nagasaki kumamoto oita miyazaki kagoshima okinawa".split(
    " ",
  );
export const prefecturePages = prefectures.map((pref, index) => ({
  name: pref.name,
  code: pref.code,
  slug: slugs[index],
}));
export const otherPrefecturePage = {
  name: "その他の団体",
  code: "other",
  slug: "other",
};

/** How the whole list names itself in its HTML (`cards.html`). */
export const CATALOG_HEAD = {
  title: "マンホールカード一覧｜都道府県別の配布場所 - マンホール手帳",
  description:
    "都道府県・自治体ごとにマンホールカードの配布場所を一覧で確認できます。自治体名・施設名・カード番号で検索し、配布施設の情報や地図上の位置を探せます。",
};
/**
 * How a prefecture's list names itself, in its HTML (`/pref/<slug>/`) and in
 * the head a switch writes. The words are the ones people search with:
 * 「東京 マンホールカード一覧」「栃木県 マンホールカード配布場所」
 * 「広島 マンホールカード 地図」. `total` is the build's count; a head
 * written without knowing it, or for a prefecture with no card, leaves it out.
 */
export function prefectureListHead(name: string, total?: number) {
  return {
    title: `${name}のマンホールカード一覧｜配布場所の地図 - マンホール手帳`,
    description: `${name}${total ? `の${total}枚` : ""}のマンホールカードの配布場所・配布時間・配布状態を一覧と地図で確認できます。`,
  };
}
/**
 * What follows the prefecture's name in the list's heading. The page shows
 * the name alone; the rest is read out, and read by a search.
 */
export const PREFECTURE_HEADING_REST = "のマンホールカード一覧と配布場所";
