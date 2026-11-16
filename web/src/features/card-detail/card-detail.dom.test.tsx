import { afterEach, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { fixtureData } from "../../../scripts/fixtures";
import { createCardCatalog } from "../../domain/card-catalog";
import type { Data } from "../../domain/types";
import { CardDetail } from "./card-detail";

afterEach(cleanup);

type Place = Data["places"][number];

const facility = fixtureData.places[0]!;
const card = fixtureData.cards[0]!;

function renderDetail(place: Place, variant: "map" | "catalog" = "map") {
  const data: Data = {
    ...fixtureData,
    places: [place],
    relations: fixtureData.relations.filter(
      (relation) => relation.placeId === place.id,
    ),
  };
  return render(
    <CardDetail
      card={card}
      data={data}
      catalog={createCardCatalog(data)}
      variant={variant}
    />,
  );
}

it.each(["map", "catalog"] as const)(
  "omits phone numbers from %s detail",
  (variant) => {
    const phone = "03-1234-5678";
    const { container } = renderDetail({ ...facility, phone }, variant);
    expect(container.querySelector('a[href^="tel:"]')).toBeNull();
    expect(screen.queryByText(phone)).toBeNull();
    expect(
      screen.getByText("訪問前に配布情報の出典をご確認ください。"),
    ).toBeTruthy();
  },
);

it.each(["map", "catalog"] as const)(
  "omits the card page link from %s detail",
  (variant) => {
    renderDetail(facility, variant);
    expect(
      screen.queryByRole("link", { name: "このカードのページ" }),
    ).toBeNull();
  },
);

it("omits the confirmed facility address from map detail", () => {
  renderDetail(facility);
  expect(screen.queryByText(facility.address)).toBeNull();
});

it.each([
  { coordinate: { status: "unconfirmed" } },
  { coordinate: { ...facility.coordinate, status: "candidate" } },
  {
    locationReview: { status: "withdrawn", reason: "移転確認中" },
  },
] satisfies Partial<Place>[])(
  "keeps the address visible when map detail searches for the facility: %j",
  (location) => {
    renderDetail({ ...facility, ...location });
    expect(screen.getByText(facility.address)).toBeTruthy();
    expect(screen.getByRole("link", { name: "住所で検索" })).toBeTruthy();
  },
);

it.each([facility.address, ""])(
  "keeps the address or missing-address fallback in catalog detail: %s",
  (address) => {
    renderDetail({ ...facility, address }, "catalog");
    expect(screen.getByText(address || "住所の記載なし")).toBeTruthy();
  },
);
