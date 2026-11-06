import { expect, it } from "vitest";
import { readFileSync } from "node:fs";
it("removes the search panel and keeps the about link", () => {
  const app = readFileSync(new URL("./app.tsx", import.meta.url), "utf8");
  expect(app).not.toContain("<SearchPanel");
  expect(app).toContain('href="/about.html"');
});
