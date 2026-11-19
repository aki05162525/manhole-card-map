import { expect, it } from "vitest";
import { aboutAttributes, readAboutSummary } from "./about-summary";

it.each([true, false])(
  "reads the published card and place counts from the page root (fixture: %s)",
  (fixture) => {
    const summary = {
      cardCount: 3,
      placeCount: 2,
      asOf: "2026-11-10",
      fixture,
    };
    const page = new DOMParser().parseFromString(
      `<div id="root" ${aboutAttributes(summary)}></div>`,
      "text/html",
    );
    expect(readAboutSummary(page.getElementById("root")!.dataset)).toEqual(
      summary,
    );
  },
);
