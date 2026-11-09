import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { CardDetail } from "./card-detail";
import type { Card, Data, Status } from "../../domain/types";
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
      reference: false,
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
      card={{ ...card, status }}
      data={data}
      catalog={null}
      selectedPinId="b"
    />,
  );
}
it("keeps original hours and telephone links without stock or date notes", () => {
  const output = html();
  for (const text of ["在庫は保証されません", "基準日", "非公式の案内"])
    expect(output).not.toContain(text);
  expect(output).toContain("訪問前に配布情報の出典をご確認ください。");
  for (const text of [
    'href="tel:03-1234-5678"',
    "午前9時～午後5時",
    "配布場所へ経路",
  ])
    expect(output).toContain(text);
  expect(output).toContain("/maps/dir/");
});
it.each(["suspended", "ended"] as const)(
  "shows the %s band and place-only action",
  (status) => {
    const output = html(status);
    expect(output).toContain(`detail-status-band ${status}`);
    if (status === "suspended") expect(output).toContain("場所を見る");
    expect(output).not.toContain("配布場所へ経路");
  },
);
it("puts the tapped counter first and marks only that place", () => {
  const output = html();
  expect(output).toContain("2か所で受け取れます");
  expect(output.indexOf("窓口b")).toBeLessThan(output.indexOf("窓口a"));
  expect(output.match(/この地点/g)).toHaveLength(1);
});
it("collects absent source fields in one line", () => {
  const output = renderToStaticMarkup(
    <CardDetail
      card={card}
      data={{ ...data, places: [], relations: [] }}
      catalog={null}
    />,
  );
  expect(output).toMatch(
    /<p class="missing-fields"><span>配布時間の記載なし<\/span><span>原文リンクの記載なし<\/span>/,
  );
});

it.each([
  ["active", "配布中", "■"],
  ["upcoming", "配布予定", "■"],
  ["suspended", "一時中止", "◧"],
  ["ended", "終了", "□"],
  ["unknown", "未確認", "□"],
] as const)("uses the shared %s chip", async (status, label, shape) => {
  const { StatusChip } = await import("../../shared/ui/status-chip");
  const output = renderToStaticMarkup(<StatusChip status={status} />);
  expect(output).toContain(label);
  expect(output).toContain('<svg width="10" height="10"');
  expect(output).not.toContain(shape);
});
