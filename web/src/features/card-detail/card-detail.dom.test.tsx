import { afterEach, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { fixtureData } from "../../../scripts/fixtures";
import { createCardCatalog } from "../../domain/card-catalog";
import { CardDetail } from "./card-detail";

afterEach(cleanup);
it.each([false, true])(
  "keeps the card page link outside the map summary (summaryMode=%s)",
  (summaryMode) => {
    const card = { ...fixtureData.cards[0]!, id: "a/b" };
    render(
      <CardDetail
        card={card}
        data={fixtureData}
        catalog={createCardCatalog(fixtureData)}
        summaryMode={summaryMode}
      />,
    );
    const link = screen.getByRole("link", { name: "このカードのページ" });
    expect(link.getAttribute("href")).toBe("/card/a%2Fb/");
    expect(link.closest(".sheet-extra")).toBeTruthy();
    expect(link.closest(".sheet-summary")).toBeNull();
  },
);
