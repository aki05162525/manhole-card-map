import { renderToStaticMarkup } from "react-dom/server";
import { cleanup, render } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { CardDetail } from "./card-detail";
import type { Card, Data } from "../../domain/types";

afterEach(cleanup);

/** The page's part: it keeps the stop, and is told of each choice. */
const page = {
  showingLid: false,
  onShowLid() {},
  onShowPlaces() {},
  onChoosePlace() {},
};
const card: Card = {
  id: "01-231-B001",
  pref: "北海道",
  city: "恵庭市 (B001)",
  series: "第13弾",
  issued: "",
  acquired: "",
  status: "suspended",
  lid: { status: "confirmed", lat: 35, lng: 139 },
  hours: ["午前9時～午後5時"],
  links: null,
  placeText: null,
};
const data: Data = {
  schema: 1,
  updated: "",
  cards: [card],
  places: ["a", "b"].map((id) => ({
    id,
    name: `施設${id}`,
    address: "住所",
    phone: "",
    coordinate: { status: "confirmed", lat: 35, lng: 139 },
  })),
  relations: ["a", "b"].map((placeId) => ({
    cardId: card.id,
    placeId,
    condition: "",
    periodRaw: "",
    alternativeRaw: "",
  })),
  pins: [
    {
      id: "b",
      kind: "place",
      cardIds: [card.id],
      status: "suspended",
      pref: "北海道",
      lat: 35,
      lng: 139,
    },
  ],
};
const output = (d = data, c = card) =>
  renderToStaticMarkup(<CardDetail {...page} card={c} data={d} />);
it("B7 puts single-facility card hours below its name without the unorganized warning or duplicate hours", () => {
  const html = output({ ...data, relations: [data.relations[1]] });
  expect(html).not.toContain("この配布場所の配布時間は未確認");
  expect(html.match(/午前9時～午後5時/g)).toHaveLength(1);
  expect(html).toMatch(
    /施設b<\/span><\/p>[\s\S]*status-chip[\s\S]*distribution-hours[\s\S]*午前9時～午後5時/,
  );
});
it("B7 does not repeat the card-wide original hours under several facilities", () => {
  const html = output();
  expect(html).not.toContain("カード全体の配布時間（原文）");
  expect(html).not.toContain("card-original-hours");
});
it.each([
  ["suspended", "配布は一時中止中です"],
  ["ended", "配布は終了しています"],
] as const)(
  "B10 gives an actionable %s band and omits the city suffix",
  (status, message) => {
    const html = output(data, { ...card, status });
    expect(html).toContain(message);
    expect(html).not.toContain("恵庭市 (B001)");
  },
);
it("B10 omits the first facility link duplicated by the main action but retains other destinations", () => {
  const html = output();
  expect(html).not.toContain("施設bをGoogleマップで場所を見る");
  expect(html).not.toContain("施設aをGoogleマップで場所を見る");
  expect(html).toContain("施設a</span></label>");
});
it("B11a gives an ended card without facilities a municipality heading", () => {
  const html = output(
    { ...data, places: [], relations: [], pins: [] },
    { ...card, status: "ended" },
  );
  expect(html).toMatch(/<h2 class="detail-title" tabindex="-1">恵庭市<\/h2>/);
});

const withdrawnPin: Data = {
  ...data,
  places: [
    {
      ...data.places[0],
      locationReview: { status: "withdrawn", reason: "移転" },
    },
    data.places[1],
  ],
  pins: [{ ...data.pins[0], id: "a" }, ...data.pins],
};
it.each([
  ["the visible pin", data, undefined, "施設b", "施設a"],
  [
    "the visible pin after a withdrawal",
    withdrawnPin,
    undefined,
    "施設b",
    "施設a",
  ],
  ["the explicitly tapped counter", data, "a", "施設a", "施設b"],
] as const)("puts %s first and selects it", (_, source, pin, first, second) => {
  const view = render(
    <CardDetail {...page} card={card} data={source} selectedPinId={pin} />,
  );
  expect(view.getAllByRole("radio")).toEqual([
    view.getByRole("radio", { name: first, checked: true }),
    view.getByRole("radio", { name: second, checked: false }),
  ]);
});

it("shows the card's own hours when no place is registered for it, whatever other cards have", () => {
  // The relations here are another card's: this card has no counter.
  const others = {
    ...data,
    relations: data.relations.map((relation) => ({
      ...relation,
      cardId: "other",
      hours: ["別のカードの時間"],
    })),
  };
  const html = output(others, { ...card, hours: ["平日9時", "休日10時"] });
  expect(html).toContain('<p class="distribution-hours">平日9時\n休日10時</p>');
  expect(html).not.toContain("別のカードの時間");
  // Nor do their hours stand in for hours this card lacks.
  expect(output(others, { ...card, hours: null })).toContain(
    "配布時間の記載なし",
  );
});
