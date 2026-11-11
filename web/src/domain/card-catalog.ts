import { matchingCards, visiblePins } from "./card-selection";
import {
  catalogPrefCode,
  OTHER_PREF,
  type CatalogSummary,
} from "./catalog-summary";
import { areas, prefectures } from "../prefectures";
import type { Card, Data } from "./types";

export const CATALOG_PAGE_SIZE = 50;
export const OTHER_PREF_LABEL = "その他（県の登録なし）";
export type PinReason =
  | "location-unconfirmed"
  | "relation-review"
  | "no-facility"
  | "partial";
export const pinReasonLabels: Record<PinReason, string> = {
  "location-unconfirmed": "配布場所の位置は未確定または未確認です",
  "relation-review": "配布情報は未確認です",
  "no-facility": "配布場所の登録なし",
  partial: "地図に表示できる配布場所は一部です",
};
export type CatalogEntry = {
  card: Card;
  pref: string;
  relations: Data["relations"];
  places: Data["places"];
  facilityCount: number;
  facilitySummary: string;
  hasPin: boolean;
  pinReasons: PinReason[];
};
export type CatalogCount = {
  total: number;
  withPin: number;
  withoutPin: number;
};
export type CatalogPrefecture = CatalogCount & {
  code: string;
  name: string;
  area: string | null;
};
export type CardCatalog = ReturnType<typeof createCardCatalog>;
type OverviewPrefecture = Pick<CatalogPrefecture, "code" | "name" | "total">;
/** The counts the region choice shows, which a catalog also satisfies. */
export type CatalogOverview = {
  total: number;
  areas: { id: string; name: string; prefectures: OverviewPrefecture[] }[];
  other: OverviewPrefecture;
};
export function catalogOverview({ totals }: CatalogSummary): CatalogOverview {
  const count = (code: string, name: string) => ({
    code,
    name,
    total: totals[code] ?? 0,
  });
  return {
    total: Object.values(totals).reduce((sum, total) => sum + total, 0),
    areas: areas.map((area) => ({
      id: area.id,
      name: area.name,
      prefectures: prefectures
        .filter((pref) => pref.area === area.id)
        .map((pref) => count(pref.code, pref.name)),
    })),
    other: count(OTHER_PREF, OTHER_PREF_LABEL),
  };
}

/** Build once per data load; rows read entriesById without scanning all facilities. */
export function createCardCatalog(data: Data) {
  const placesById = new Map(data.places.map((place) => [place.id, place]));
  const cardsById = new Map(data.cards.map((card) => [card.id, card]));
  const relationsByCard = new Map<string, Data["relations"]>();
  for (const relation of data.relations) {
    const group = relationsByCard.get(relation.cardId) ?? [];
    group.push(relation);
    relationsByCard.set(relation.cardId, group);
  }
  const pinsByCard = new Map<string, Set<string>>();
  for (const pin of visiblePins(data, false)) {
    for (const id of pin.cardIds) {
      const places = pinsByCard.get(id) ?? new Set<string>();
      places.add(pin.id);
      pinsByCard.set(id, places);
    }
  }
  const cards = [...data.cards].sort((a, b) => {
    const prefA = catalogPrefCode(a),
      prefB = catalogPrefCode(b);
    return prefA.localeCompare(prefB) || a.id.localeCompare(b.id);
  });
  const entriesById = new Map<string, CatalogEntry>();
  const counts = new Map<string, CatalogPrefecture>(
    prefectures.map((pref) => [
      pref.code,
      {
        code: pref.code,
        name: pref.name,
        area: pref.area,
        total: 0,
        withPin: 0,
        withoutPin: 0,
      },
    ]),
  );
  const other: CatalogPrefecture = {
    code: OTHER_PREF,
    name: OTHER_PREF_LABEL,
    area: null,
    total: 0,
    withPin: 0,
    withoutPin: 0,
  };
  counts.set(OTHER_PREF, other);
  let withPin = 0;
  for (const card of cards) {
    const relations = relationsByCard.get(card.id) ?? [];
    const places = [...new Set(relations.map((r) => r.placeId))].flatMap(
      (id) => {
        const place = placesById.get(id);
        return place ? [place] : [];
      },
    );
    const mapped = pinsByCard.get(card.id) ?? new Set<string>();
    const hasPin = mapped.size > 0;
    const reasons = new Set<PinReason>();
    if (!places.length) reasons.add("no-facility");
    for (const relation of relations) {
      if (mapped.has(relation.placeId)) continue;
      if (!placesById.has(relation.placeId)) reasons.add("no-facility");
      else if (relation.review === "needs-review")
        reasons.add("relation-review");
      else reasons.add("location-unconfirmed");
    }
    const reasonOrder: PinReason[] = [
      "relation-review",
      "location-unconfirmed",
      "no-facility",
    ];
    const pinReasons: PinReason[] = hasPin
      ? reasons.size
        ? ["partial"]
        : []
      : reasonOrder.filter((reason) => reasons.has(reason));
    const pref = catalogPrefCode(card);
    entriesById.set(card.id, {
      card,
      pref,
      relations,
      places,
      facilityCount: places.length,
      facilitySummary: places.length
        ? `${places[0].name}${places.length > 1 ? ` ほか${places.length - 1}施設` : ""}`
        : "配布場所の登録なし",
      hasPin,
      pinReasons,
    });
    const count = counts.get(pref)!;
    count.total++;
    if (hasPin) {
      count.withPin++;
      withPin++;
    } else count.withoutPin++;
  }
  return {
    data,
    cards,
    cardsById,
    placesById,
    relationsByCard,
    entriesById,
    total: cards.length,
    withPin,
    withoutPin: cards.length - withPin,
    prefectures: prefectures.map((pref) => counts.get(pref.code)!),
    other,
    areas: areas.map((area) => {
      const prefs = prefectures
        .filter((pref) => pref.area === area.id)
        .map((pref) => counts.get(pref.code)!);
      return {
        id: area.id,
        name: area.name,
        prefectures: prefs,
        ...prefs.reduce<CatalogCount>(
          (sum, pref) => ({
            total: sum.total + pref.total,
            withPin: sum.withPin + pref.withPin,
            withoutPin: sum.withoutPin + pref.withoutPin,
          }),
          { total: 0, withPin: 0, withoutPin: 0 },
        ),
      };
    }),
  };
}

export function catalogCards(
  catalog: CardCatalog,
  { pref = null, q = "" }: { pref?: string | null; q?: string } = {},
): Card[] {
  const cards = pref
    ? catalog.cards.filter((card) => catalogPrefCode(card) === pref)
    : catalog.cards;
  return matchingCards(cards, q, catalog.data);
}
export type CatalogPage = {
  cards: Card[];
  page: number;
  requestedPage: number;
  total: number;
  totalPages: number;
  start: number;
  end: number;
  outOfRange: boolean;
};
export function paginateCards(cards: Card[], requestedPage = 1): CatalogPage {
  const totalPages = Math.max(1, Math.ceil(cards.length / CATALOG_PAGE_SIZE));
  const valid = Number.isSafeInteger(requestedPage) && requestedPage >= 1;
  const page = valid ? Math.min(requestedPage, totalPages) : 1;
  const offset = (page - 1) * CATALOG_PAGE_SIZE;
  return {
    cards: cards.slice(offset, offset + CATALOG_PAGE_SIZE),
    page,
    requestedPage,
    total: cards.length,
    totalPages,
    start: cards.length ? offset + 1 : 0,
    end: Math.min(offset + CATALOG_PAGE_SIZE, cards.length),
    outOfRange: !valid || requestedPage !== page,
  };
}
