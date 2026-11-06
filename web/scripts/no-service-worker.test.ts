import { expect, test } from "vitest";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

test("画面コードは Service Worker を登録しない", () => {
  const source = readdirSync("src", {
    recursive: true,
    encoding: "utf8",
  }).filter((f) => /\.tsx?$/.test(f) && !f.includes(".test."));
  expect(source).toContain("app.tsx");
  for (const file of source) {
    expect(readFileSync(resolve("src", file), "utf8")).not.toMatch(
      /serviceWorker/,
    );
  }
});

test("配信物の準備処理は sw.js を生成しない", () => {
  const cwd = mkdtempSync(join(tmpdir(), "no-sw-"));
  try {
    const output = join(cwd, "dist-fixture");
    mkdirSync(join(output, "assets"), { recursive: true });
    writeFileSync(join(output, "index.html"), "<!doctype html>");
    const result = spawnSync(
      process.execPath,
      [resolve("scripts/prepare.mjs"), "--fixture"],
      { cwd, encoding: "utf8" },
    );
    expect(result.status, result.stderr).toBe(0);
    expect(existsSync(join(output, "index.html.br"))).toBe(true);
    expect(existsSync(join(output, "sw.js"))).toBe(false);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
