import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

it("keeps source document links extensionless while allowing external HTML URLs", () => {
  const violations: string[] = [];
  for (const file of readdirSync("src", {
    recursive: true,
    encoding: "utf8",
  })) {
    if (!/\.tsx?$/.test(file) || /\.test\./.test(file)) continue;
    const source = readFileSync(join("src", file), "utf8");
    // Root-relative string URLs only: external authorities are not site links.
    for (const match of source.matchAll(/["'`]\/(?!\/)[^"'`\s]*\.html\b/g))
      violations.push(`${file}: ${match[0]}`);
  }
  expect(violations).toEqual([]);
});
