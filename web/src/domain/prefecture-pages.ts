import { prefectures } from "../prefectures";

// JIS prefecture-code order. Kept separate from the generated geographic master.
const slugs =
  "hokkaido aomori iwate miyagi akita yamagata fukushima ibaraki tochigi gunma saitama chiba tokyo kanagawa niigata toyama ishikawa fukui yamanashi nagano gifu shizuoka aichi mie shiga kyoto osaka hyogo nara wakayama tottori shimane okayama hiroshima yamaguchi tokushima kagawa ehime kochi fukuoka saga nagasaki kumamoto oita miyazaki kagoshima okinawa".split(
    " ",
  );
export const prefecturePages = prefectures.map((pref, index) => ({
  name: pref.name,
  code: pref.code,
  slug: slugs[index]!,
}));
export const otherPrefecturePage = {
  name: "その他の団体",
  code: "other",
  slug: "other",
};
export function prefecturePage(name: string) {
  return (
    prefecturePages.find((pref) => pref.name === name) ?? otherPrefecturePage
  );
}
