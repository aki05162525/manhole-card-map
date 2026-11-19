import { expect, it } from "vitest";
import { embedCatalogSummary, readCatalogSummary } from "./catalog-summary";

it("reads the published evaluation date and prefecture totals from the page root", () => {
  const evaluatedAt = 'a&quot;"b';
  const html = embedCatalogSummary("<main data-catalog-summary></main>", {
    evaluatedAt,
    totals: { "01": 3, other: 2 },
  });
  const page = new DOMParser().parseFromString(html, "text/html");
  expect(readCatalogSummary(page.querySelector("main")!.dataset)).toMatchObject(
    {
      evaluatedAt,
      totals: { "01": 3, "13": 0, other: 2 },
    },
  );
});
