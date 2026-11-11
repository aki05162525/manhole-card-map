import type { Coord, Data } from "./types";
export type MapLink = { href: string; label: string };
// Maps destinations use geographic bounds, independent of the map camera policy.
function confirmedQuery(coord: Coord): string | null {
  return coord.status === "confirmed" &&
    typeof coord.lat === "number" &&
    typeof coord.lng === "number" &&
    Number.isFinite(coord.lat) &&
    Number.isFinite(coord.lng) &&
    Math.abs(coord.lat) <= 90 &&
    Math.abs(coord.lng) <= 180
    ? `${coord.lat},${coord.lng}`
    : null;
}
function maps(query: string, label: string, directions = false): MapLink {
  return {
    href: `https://www.google.com/maps/${directions ? "dir" : "search"}/?${new URLSearchParams(directions ? { api: "1", destination: query } : { api: "1", query })}`,
    label,
  };
}
export function facilityMapLink(
  place?: Data["places"][number],
  relation?: Data["relations"][number],
  viewOnly = false,
): MapLink | null {
  if (!place || (relation?.review === "needs-review" && relation.evidence))
    return null;
  const location = place.locationReview;
  const query =
    !location || location.status === "confirmed"
      ? confirmedQuery(place.coordinate)
      : null;
  if (query !== null)
    return maps(query, "配布場所をGoogle Mapsで表示（確定座標）", !viewOnly);
  const search = [place.name.trim(), place.address.trim()]
    .filter(Boolean)
    .join(" ");
  return search
    ? maps(search, "配布場所をGoogle Mapsで施設名・住所で検索（位置未確定）")
    : null;
}
export function lidMapLink(coord: Coord): MapLink | null {
  const query = confirmedQuery(coord);
  return query !== null
    ? maps(query, "蓋をGoogle Mapsで経路表示（カード印刷座標）", true)
    : null;
}
export function safeHttpUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) &&
      !url.username &&
      !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}
