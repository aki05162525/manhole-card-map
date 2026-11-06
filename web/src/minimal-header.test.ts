import { expect, it } from "vitest";
import { readFileSync } from "node:fs";
it("connects catalog search and URL selection independently of map readiness", () => {
  const app = readFileSync(new URL("./app.tsx", import.meta.url), "utf8");
  expect(app).toContain("<MapSearch");
  expect(app).toContain("useMapUrlState");
  expect(app).toContain("createCardCatalog");
  expect(app).toContain("検証用の架空データ");
  expect(app).not.toContain("<SearchPanel");
});
