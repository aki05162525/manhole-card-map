import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import type { Data } from "../../domain/types";
import { UpcomingChanges } from "./upcoming-changes";

type Relation = Data["relations"][number];
const render = (upcoming: Relation["upcoming"], asOf?: string) =>
  renderToStaticMarkup(
    createElement(UpcomingChanges, {
      relation: {
        cardId: "card",
        placeId: "a",
        condition: "",
        periodRaw: "",
        alternativeRaw: "",
        status: "active",
        ...(upcoming ? { upcoming } : {}),
      },
      asOf,
      placeName: (id) => id,
    }),
  );

it("renders nothing for a counter without planned changes", () => {
  expect(render(undefined, "2026-11-01")).toBe("");
  expect(render([], "2026-11-01")).toBe("");
});

it("lists each change from its date, under the date the plan was checked on", () => {
  const upcoming = [
    { validFrom: "2026-12-01", status: "suspended", condition: "" },
    { validFrom: "2027-01-04", status: "active", condition: "" },
  ] as const;
  const html = render([...upcoming], "2026-11-01");
  expect(html).toContain(">今後の変更（2026-11-01時点の予定）</p>");
  expect(html).toContain(
    '<li><time dateTime="2026-12-01">2026-12-01</time>から一時中止</li>' +
      '<li><time dateTime="2027-01-04">2027-01-04</time>から配布中</li>',
  );
  // Data without an evaluation date states no date.
  expect(render([...upcoming])).toContain(">今後の変更（予定）</p>");
});
