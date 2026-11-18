import { afterEach, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { fixtureData } from "../../../scripts/fixtures";
import { createCardCatalog } from "../../domain/card-catalog";
import type { Data } from "../../domain/types";
import { CardDetail } from "./card-detail";

afterEach(cleanup);

type Place = Data["places"][number];

const facility = fixtureData.places[0];
const card = fixtureData.cards[0];

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
  },
);

// The list's rows link to the card's page; the shared detail, and so the
// map's sheet, carries no such link.
it.each(["map", "catalog"] as const)(
  "links no card page from the shared %s detail",
  (variant) => {
    const { container } = renderDetail(facility, variant);
    expect(container.querySelector('a[href^="/card/"]')).toBeNull();
    expect(screen.queryByRole("link", { name: /このカードの/ })).toBeNull();
  },
);

it.each(["map", "catalog"] as const)(
  "omits the confirmed facility address from %s detail",
  (variant) => {
    renderDetail(facility, variant);
    expect(screen.queryByText(facility.address)).toBeNull();
    expect(screen.queryByText("住所の記載なし")).toBeNull();
  },
);

it.each([
  { coordinate: { status: "unconfirmed" } },
  { coordinate: { ...facility.coordinate, status: "candidate" } },
  {
    locationReview: { status: "withdrawn", reason: "移転確認中" },
  },
] satisfies Partial<Place>[])(
  "keeps the address visible when detail searches for the facility: %j",
  (location) => {
    for (const variant of ["map", "catalog"] as const) {
      const view = renderDetail({ ...facility, ...location }, variant);
      expect(screen.getByText(facility.address)).toBeTruthy();
      expect(screen.getByRole("link", { name: "住所で検索" })).toBeTruthy();
      view.unmount();
    }
  },
);

it("keeps the card source available when the selected counter has no evidence", () => {
  const c = { ...card, links: ["https://example.org/card-source"] };
  render(
    <CardDetail
      card={c}
      data={{
        ...fixtureData,
        relations: fixtureData.relations
          .filter((r) => r.cardId === c.id)
          .map(
            (r) =>
              Object.fromEntries(
                Object.entries(r).filter(([key]) => key !== "evidence"),
              ) as typeof r,
          ),
      }}
      catalog={null}
    />,
  );
  expect(
    screen.getByRole("link", { name: "配布情報の出典" }).getAttribute("href"),
  ).toBe("https://example.org/card-source");
});
