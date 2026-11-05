import { describe, expect, it } from "vitest";
import {
  detailCard,
  cardsForIds,
  facilityMapLink,
  lidMapLink,
  safeHttpUrl,
} from "./ui";
import type { Card, Coord, Data } from "./types";
const coordinate: Coord = {
  status: "confirmed",
  lat: 35,
  lng: 139,
  review: "",
};
const place: Data["places"][number] = {
  id: "p",
  name: "施設 & 案内所",
  address: "東京都 #1",
  phone: "",
  coordinate,
};
describe("Google Maps links", () => {
  it("opens confirmed facility coordinates using keyless Maps search", () => {
    const link = facilityMapLink(place)!;
    const url = new URL(link.href);
    expect(url.origin + url.pathname).toBe(
      "https://www.google.com/maps/search/",
    );
    expect(url.searchParams.get("api")).toBe("1");
    expect(url.searchParams.get("query")).toBe("35,139");
    expect(link.label).toContain("確定座標");
  });
  it.each(["candidate", "unconfirmed"])(
    "searches names and addresses for %s without candidate coordinates",
    (status) => {
      const link = facilityMapLink({
        ...place,
        coordinate: { ...coordinate, status },
      })!;
      expect(new URL(link.href).searchParams.get("query")).toBe(
        "施設 & 案内所 東京都 #1",
      );
      expect(link.label).toContain("施設名・住所で検索");
      expect(link.href).not.toContain("35%2C139");
    },
  );
  it.each([
    [91, 139],
    [35, 181],
    [NaN, 139],
    [35, Infinity],
    [undefined, 139],
  ])("rejects invalid coordinates %s %s", (lat, lng) => {
    const invalid = { ...coordinate, lat, lng };
    expect(lidMapLink(invalid)).toBeNull();
    expect(facilityMapLink({ ...place, coordinate: invalid })!.label).toContain(
      "施設名・住所で検索",
    );
  });
  it("never links unconfirmed lids and accepts valid zero and boundary coordinates", () => {
    expect(lidMapLink({ ...coordinate, status: "candidate" })).toBeNull();
    expect(lidMapLink({ ...coordinate, status: "unconfirmed" })).toBeNull();
    expect(
      new URL(
        lidMapLink({ ...coordinate, lat: 0, lng: -180 })!.href,
      ).searchParams.get("query"),
    ).toBe("0,-180");
  });
  it("handles missing facilities or search text without inventing a location", () => {
    expect(facilityMapLink(undefined)).toBeNull();
    expect(
      facilityMapLink({
        ...place,
        name: " ",
        address: "",
        coordinate: { ...coordinate, status: "candidate" },
      }),
    ).toBeNull();
  });
});
it("allows only parsed HTTP(S) official URLs", () => {
  expect(safeHttpUrl("https://example.com/?q=<script>")).not.toBeNull();
  expect(safeHttpUrl("http://example.com")).not.toBeNull();
  for (const value of [
    "javascript:alert(1)",
    "data:text/html,a",
    "/relative",
    "https://",
    "https://user:pass@example.com",
  ])
    expect(safeHttpUrl(value)).toBeNull();
});
it("keeps every clustered/shared card selectable, deduplicates and ignores unknown ids", () => {
  const cards = Array.from(
    { length: 10000 },
    (_, i) => ({ id: String(i) }) as Card,
  );
  const result = cardsForIds(new Map(cards.map((c) => [c.id, c])), [
    ...cards.map((c) => c.id),
    "0",
    "missing",
  ]);
  expect(result).toHaveLength(10000);
  expect(result[9999]).toBe(cards[9999]);
  expect(cardsForIds(new Map(), ["missing"])).toEqual([]);
});

it("renders no card details until a dense/shared group chooses one, and back restores the list", () => {
  const group = [{ id: "a" }, { id: "b" }] as Card[];
  expect(detailCard(group)).toBeUndefined();
  expect(detailCard(group, "b")).toBe(group[1]);
  expect(detailCard(group, "missing")).toBeUndefined();
  expect(detailCard(group)).toBeUndefined();
  expect(detailCard([group[0]!])).toBe(group[0]);
  expect(detailCard([])).toBeUndefined();
});

it("does not navigate to obsolete reviewed facilities after their source changes", () => {
  const stale = {
    review: "needs-review",
    evidence: { sourceUrl: "https://example.gov.jp" },
  } as Data["relations"][number];
  expect(facilityMapLink(place, stale)).toBeNull();
  expect(
    facilityMapLink(place, { review: "verified" } as Data["relations"][number]),
  ).not.toBeNull();
  const unreviewed = {
    ...place,
    coordinate: { ...coordinate, status: "unconfirmed" },
  };
  expect(
    facilityMapLink(unreviewed, {
      review: "needs-review",
    } as Data["relations"][number])?.label,
  ).toContain("施設名・住所で検索");
});
