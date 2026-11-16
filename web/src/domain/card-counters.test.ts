import { expect, it } from "vitest";
import { cardCounters, opensAtLid } from "./card-counters";
import type { Card, Data } from "./types";

const card: Card = {
  id: "c",
  pref: "県",
  city: "市",
  series: "",
  issued: "",
  acquired: "",
  status: "active",
  lid: { status: "confirmed", lat: 36, lng: 140 },
  hours: ["9時〜17時"],
  links: null,
  placeText: null,
};
const place = (id: string, name: string): Data["places"][number] => ({
  id,
  name,
  address: "",
  phone: "",
  coordinate: { status: "confirmed", lat: 35, lng: 139 },
});
const relation = (
  placeId: string,
  more: Partial<Data["relations"][number]> = {},
): Data["relations"][number] => ({
  cardId: "c",
  placeId,
  condition: "",
  periodRaw: "",
  alternativeRaw: "",
  ...more,
});
const data = (
  places: Data["places"],
  relations: Data["relations"],
  pins: Data["pins"] = [],
): Data => ({ schema: 1, updated: "", cards: [card], places, relations, pins });

it("lists a place once when the ledger repeats the same relation", () => {
  // 07-214-B001: the same place, text and missing `applies` twice.
  const d = data(
    [place("a", "中央公民館"), place("b", "白沢公民館")],
    [
      relation("a", { hours: ["9時"] }),
      relation("a", { hours: ["9時"] }),
      relation("b"),
    ],
  );
  expect(cardCounters(d, card).map((counter) => counter.name)).toEqual([
    "中央公民館",
    "白沢公民館",
  ]);
});

it("numbers counters that would otherwise read the same", () => {
  // 01-234-A001: two places share a name and differ only in the free text.
  const d = data(
    [place("a", "9:30から18:00まで"), place("b", "9:30から18:00まで")],
    [
      relation("a", { condition: "4月から5月" }),
      relation("b", { condition: "9月から10月" }),
    ],
  );
  expect(cardCounters(d, card).map((counter) => counter.name)).toEqual([
    "9:30から18:00まで（1）",
    "9:30から18:00まで（2）",
  ]);
});

it("keeps the same place apart when its typed conditions differ", () => {
  const d = data(
    [place("a", "役場")],
    [
      relation("a", {
        applies: {
          kind: "calendar",
          weekdays: [1, 2, 3, 4, 5],
          holiday: "exclude",
        },
      }),
      relation("a", {
        applies: { kind: "calendar", weekdays: [6, 7], holiday: "include" },
      }),
    ],
  );
  expect(
    cardCounters(d, card).map((counter) => [counter.when, counter.name]),
  ).toEqual([
    ["平日", "役場"],
    ["土日祝", "役場"],
  ]);
});

it("names a nameless place and offers no destination for it", () => {
  // 14-218-B001 and 34-212-C001: neither a name nor an address to search.
  const nameless = {
    ...place("a", ""),
    coordinate: { status: "unconfirmed" },
  };
  const [counter] = cardCounters(data([nameless], [relation("a")]), card);
  expect(counter?.name).toBe("名称未確認の配布場所");
  expect(counter?.link).toBeNull();
});

it("opens at the lid only when nothing was tapped and the card cannot be received", () => {
  const places = [place("a", "役場")];
  const served = data(places, [relation("a")]);
  const ended = { ...card, status: "ended" as const };
  expect(opensAtLid(served, card)).toBe(false);
  expect(opensAtLid(served, ended)).toBe(true);
  // The tapped pin stays the destination: the map does not leave it.
  expect(opensAtLid(served, ended, "a")).toBe(false);
  expect(opensAtLid(data(places, []), card)).toBe(true);
  expect(
    opensAtLid(data(places, []), { ...card, lid: { status: "unconfirmed" } }),
  ).toBe(false);
});

it("keeps the source of a repeated relation whichever comes first", () => {
  // A place with no name, address or confirmed point: only the source leads anywhere.
  const bare = { ...place("a", ""), coordinate: { status: "unconfirmed" } };
  const evidence = {
    sourceUrl: "https://example.jp/card",
    checkedAt: "2026-11-16",
  };
  for (const relations of [
    [
      relation("a", { review: "needs-review" }),
      relation("a", { review: "needs-review", evidence }),
    ],
    [
      relation("a", { review: "needs-review", evidence }),
      relation("a", { review: "needs-review" }),
    ],
  ]) {
    const counters = cardCounters(data([bare], relations), card);
    expect(counters).toHaveLength(1);
    expect(counters[0]!.relation.evidence).toEqual(evidence);
  }
});
