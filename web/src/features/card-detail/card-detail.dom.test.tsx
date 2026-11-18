import { afterEach, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { fixtureData } from "../../../scripts/build/fixtures";
import type { Data } from "../../domain/types";
import { CardDetail } from "./card-detail";

afterEach(cleanup);

type Place = Data["places"][number];

const facility = fixtureData.places[0];
const card = fixtureData.cards[0];
/** The page's part: it keeps the stop, and is told of each choice. */
const page = {
  showingLid: false,
  onShowLid() {},
  onShowPlaces() {},
  onChoosePlace() {},
};

function renderDetail(place: Place) {
  const data: Data = {
    ...fixtureData,
    places: [place],
    relations: fixtureData.relations.filter(
      (relation) => relation.placeId === place.id,
    ),
  };
  return render(<CardDetail {...page} card={card} data={data} />);
}

it("omits phone numbers from the detail", () => {
  const phone = "03-1234-5678";
  const { container } = renderDetail({ ...facility, phone });
  expect(container.querySelector('a[href^="tel:"]')).toBeNull();
  expect(screen.queryByText(phone)).toBeNull();
});

// The list's rows link to the card's page; the shared detail, and so the
// map's sheet, carries no such link.
it("links no card page from the detail", () => {
  const { container } = renderDetail(facility);
  expect(container.querySelector('a[href^="/card/"]')).toBeNull();
  expect(screen.queryByRole("link", { name: /このカードの/ })).toBeNull();
});

const locationNotes = /未確定|取り下げ済み/;
it("omits the address of a confirmed facility, and says nothing of its location", () => {
  renderDetail(facility);
  expect(screen.queryByText(facility.address)).toBeNull();
  expect(screen.queryByText("住所の記載なし")).toBeNull();
  expect(screen.queryByText(locationNotes)).toBeNull();
});

it.each([
  [{ coordinate: { status: "unconfirmed" } }, "地図の位置は未確定"],
  [
    { coordinate: { ...facility.coordinate, status: "candidate" } },
    "参考位置（未確定）",
  ],
  [
    { locationReview: { status: "withdrawn", reason: "移転確認中" } },
    "配布場所の位置は取り下げ済み",
  ],
] satisfies [Partial<Place>, string][])(
  "keeps the address visible when detail searches for the facility, and says why: %j",
  (location, note) => {
    renderDetail({ ...facility, ...location });
    expect(screen.getByText(facility.address)).toBeTruthy();
    expect(screen.getByRole("link", { name: "住所で検索" })).toBeTruthy();
    expect(screen.getByText(locationNotes).textContent).toBe(note);
  },
);

it("keeps the card source available when the selected counter has no evidence", () => {
  const c = { ...card, links: ["https://example.org/card-source"] };
  render(
    <CardDetail
      {...page}
      card={c}
      data={{
        ...fixtureData,
        relations: fixtureData.relations
          .filter((r) => r.cardId === c.id)
          .map(({ evidence: _evidence, ...rest }) => rest),
      }}
    />,
  );
  expect(
    screen.getByRole("link", { name: "配布情報の出典" }).getAttribute("href"),
  ).toBe("https://example.org/card-source");
});
