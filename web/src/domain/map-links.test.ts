import { describe, expect, it } from "vitest";
import { facilityMapLink, lidMapLink, safeHttpUrl } from "./map-links";
import type { Coord, Data } from "./types";
const coordinate: Coord = {
  status: "confirmed",
  lat: 35,
  lng: 139,
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

it.each(["needs-review", "withdrawn"] as const)(
  "uses only the valid address when the location is %s, even with stale confirmed coordinates",
  (status) => {
    const changed = {
      ...place,
      locationReview: {
        status,
        addressStatus: "valid" as const,
        reason: "座標根拠の再確認",
      },
    };
    const link = facilityMapLink(changed)!;
    expect(new URL(link.href).searchParams.get("query")).toBe(
      "施設 & 案内所 東京都 #1",
    );
    expect(link.label).toContain("施設名・住所で検索");
    expect(
      facilityMapLink({
        ...changed,
        locationReview: {
          ...changed.locationReview,
          addressStatus: "needs-review",
        },
      }),
    ).toBeNull();
    expect(
      facilityMapLink(changed, {
        review: "needs-review",
        evidence: { sourceUrl: "https://example.gov.jp" },
      } as Data["relations"][number]),
    ).toBeNull();
  },
);
it("keeps reconfirmed coordinates available from the public review status", () => {
  const link = facilityMapLink({
    ...place,
    locationReview: {
      status: "confirmed",
      addressStatus: "valid",
      reason: "同建物と再確認",
    },
  })!;
  expect(new URL(link.href).searchParams.get("query")).toBe("35,139");
});

it.each([85, 85.01, 85.051129, 86, 90].flatMap((lat) => [lat, -lat]))(
  "keeps geographic latitude %s unchanged in facility and lid links",
  (lat) => {
    for (const lng of [-180, 0, 180]) {
      const coord = { ...coordinate, lat, lng };
      for (const link of [
        facilityMapLink({ ...place, coordinate: coord }),
        lidMapLink(coord),
      ]) {
        expect(new URL(link!.href).searchParams.get("query")).toBe(
          `${lat},${lng}`,
        );
      }
    }
  },
);
it.each([90.01, -90.01, Infinity, -Infinity, NaN, "35", null, true, {}, []])(
  "does not treat invalid or coerced coordinate %j as a destination",
  (value) => {
    for (const axis of ["lat", "lng"] as const) {
      const invalid =
        typeof value === "number" && Number.isFinite(value)
          ? axis === "lng"
            ? Math.sign(value) * 180.01
            : value
          : value;
      const coord = { ...coordinate, [axis]: invalid } as unknown as Coord;
      expect(lidMapLink(coord)).toBeNull();
      expect(facilityMapLink({ ...place, coordinate: coord })!.label).toContain(
        "施設名・住所で検索",
      );
    }
  },
);
