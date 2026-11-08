import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
it("suppresses focus rings only for programmatic headings", () => {
  const css = readFileSync(new URL("./tokens.css", import.meta.url), "utf8");
  expect(css).toMatch(
    /:is\(h1, h2, h3, h4, h5, h6\)\[tabindex="-1"\]:focus[^{]*\{[^}]*outline: none/,
  );
  expect(css).toContain(":focus-visible");
});
