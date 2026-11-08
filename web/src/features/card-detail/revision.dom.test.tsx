import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { CardDetail } from "./card-detail";
import type { Card, Data } from "../../domain/types";
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
      reference: false,
    },
  ],
};
const output = (d = data, c = card) =>
  renderToStaticMarkup(<CardDetail card={c} data={d} catalog={null} />);
it("B7 puts single-facility card hours below its name without the unorganized warning or duplicate hours", () => {
  const html = output({ ...data, relations: [data.relations[1]] });
  expect(html).not.toContain("この窓口の配布時間は未整理");
  expect(html.match(/午前9時～午後5時/g)).toHaveLength(1);
  expect(html).toMatch(
    /施設b<\/h3>[\s\S]*distribution-hours[\s\S]*午前9時～午後5時[\s\S]*detail-status/,
  );
});
it("B7 labels multi-facility card hours as a separate original-text section", () => {
  const html = output();
  expect(html).toContain("カード全体の配布時間（原文）");
  expect(html.match(/午前9時～午後5時/g)).toHaveLength(1);
});
it("B8 chooses a visible facility pin first without a tapped pin and ignores reference/withdrawn pins", () => {
  const html = output();
  expect(html.indexOf("施設b")).toBeLessThan(html.indexOf("施設a"));
  const hidden = output({
    ...data,
    pins: [{ ...data.pins[0], id: "a", reference: true }, ...data.pins],
  });
  expect(hidden.indexOf("施設b")).toBeLessThan(hidden.indexOf("施設a"));
});
it.each([
  ["suspended", "配布は一時中止中です。再開は公式情報で確認してください。"],
  ["ended", "配布は終了しています。蓋は訪ねられます。"],
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
  expect(html).toContain("施設aをGoogleマップで場所を見る");
});
it("B11a gives an ended card without facilities a municipality heading", () => {
  const html = output(
    { ...data, places: [], relations: [], pins: [] },
    { ...card, status: "ended" },
  );
  expect(html).toMatch(/<h3 class="facility-title">恵庭市<\/h3>/);
});

it("B8 excludes a withdrawn facility pin from the default destination while honoring an explicit tap", () => {
  const d: Data = {
    ...data,
    places: data.places.map((place) =>
      place.id === "a"
        ? {
            ...place,
            locationReview: {
              status: "withdrawn",
              addressStatus: "valid",
              reason: "移転",
            },
          }
        : place,
    ),
    pins: [{ ...data.pins[0], id: "a" }, ...data.pins],
  };
  const html = output(d);
  expect(html.indexOf("施設b")).toBeLessThan(html.indexOf("施設a"));
  const explicit = renderToStaticMarkup(
    <CardDetail card={card} data={data} catalog={null} selectedPinId="a" />,
  );
  expect(explicit.indexOf("施設a")).toBeLessThan(explicit.indexOf("施設b"));
});
