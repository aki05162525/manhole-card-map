import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { CardDetail } from "./card-detail";
import type { Card, Data, Status } from "../../domain/types";
/** The page's part: it keeps the stop, and is told of each choice. */
const page = {
  showingLid: false,
  onShowLid() {},
  onShowPlaces() {},
  onChoosePlace() {},
};
const card: Card = {
  id: "TEST",
  pref: "県",
  city: "市",
  series: "第1弾",
  issued: "",
  acquired: "",
  status: "active",
  lid: { status: "unconfirmed" },
  hours: null,
  links: null,
  placeText: null,
};
const data: Data = {
  schema: 1,
  updated: "",
  evaluatedAt: "2026-11-01",
  cards: [card],
  pins: [
    {
      id: "pin-b",
      kind: "place",
      cardIds: ["TEST"],
      pref: "県",
      status: "active",
      lat: 35,
      lng: 139,
    },
  ],
  places: ["a", "b"].map((id) => ({
    id,
    name: `窓口${id}`,
    address: "住所",
    phone: "03-1234-5678",
    coordinate: { status: "confirmed", lat: 35, lng: 139 },
  })),
  relations: ["a", "b"].map((placeId) => ({
    cardId: "TEST",
    placeId,
    condition: "",
    periodRaw: "",
    alternativeRaw: "",
    hours: ["午前9時～午後5時"],
    status: "active",
  })),
};
// A pin's ID is the place ID in generated data; use the same identity here.
data.pins[0].id = "b";
function html(status: Status = "active") {
  return renderToStaticMarkup(
    <CardDetail
      {...page}
      card={{ ...card, status }}
      data={data}
      selectedPinId="b"
    />,
  );
}
it("keeps original hours and directions without stock or date notes", () => {
  const output = html();
  for (const text of [
    "在庫は保証されません",
    "基準日",
    "非公式の案内",
    "訪問前に配布情報の出典をご確認ください。",
    "カード記載の座標です",
  ])
    expect(output).not.toContain(text);
  for (const text of ["午前9時～午後5時", "配布場所へ行く"])
    expect(output).toContain(text);
  expect(output).toContain("/maps/dir/");
});
it.each(["suspended", "ended"] as const)(
  "shows the %s band and place-only action",
  (status) => {
    const output = html(status);
    expect(output).toContain(`detail-status-band ${status}`);
    if (status === "suspended") expect(output).toContain("場所を見る");
    expect(output).not.toContain("配布場所へ行く");
  },
);
it("puts the tapped counter first and chooses only that place", () => {
  const output = html();
  expect(output).not.toContain("ほかの配布場所");
  expect(output.indexOf("窓口b")).toBeLessThan(output.indexOf("窓口a"));
  expect(output).toMatch(/checked=""\/><span class="counter-name">窓口b/);
  expect(output.match(/checked=""/g)).toHaveLength(1);
});
it.each<[string, Partial<Card>, string[]]>([
  [
    "all of them",
    {},
    ["配布時間の記載なし", "原文リンクの記載なし", "配布場所の原文の記載なし"],
  ],
  [
    "only the one that is absent",
    { hours: ["午前9時～午後5時"], placeText: ["市役所"] },
    ["原文リンクの記載なし"],
  ],
  [
    "none, in no line at all, when a usable link is among them",
    {
      hours: ["午前9時～午後5時"],
      placeText: ["市役所"],
      links: ["javascript:alert(1)", "https://example.com/"],
    },
    [],
  ],
])("collects absent source fields in one line: %s", (_, fields, missing) => {
  const output = renderToStaticMarkup(
    <CardDetail
      {...page}
      card={{ ...card, ...fields }}
      data={{ ...data, places: [], relations: [] }}
    />,
  );
  const line = /<p class="missing-fields">(.*?)<\/p>/.exec(output)?.[1];
  expect(line).toBe(
    missing.length
      ? missing.map((field) => `<span>${field}</span>`).join("")
      : undefined,
  );
  // The card's hours stand in only where it has any.
  expect(output.includes("card-original-hours")).toBe(Boolean(fields.hours));
});
