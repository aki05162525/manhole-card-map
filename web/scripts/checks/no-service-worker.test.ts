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
import { brotliDecompressSync } from "node:zlib";

test("画面コードは Service Worker を登録しない", () => {
  const source = readdirSync("src", {
    recursive: true,
    encoding: "utf8",
  }).filter((f) => /\.tsx?$/.test(f) && !f.includes(".test."));
  expect(source).toContain("pages/map/map-page.tsx");
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
    // The built entry the card pages name (generate-static-pages.mjs).
    writeFileSync(join(output, "assets/cardRecord-test.js"), "");
    writeFileSync(join(output, "assets/cardImage-test.js"), "");
    // As Vite builds it: an empty root, which the map's search bar fills.
    writeFileSync(
      join(output, "index.html"),
      '<!doctype html><div id="root"></div>',
    );
    writeFileSync(join(output, "about.html"), "<!doctype html>");
    writeFileSync(join(output, "404.html"), "<!doctype html>");
    mkdirSync(join(output, "friends"));
    // The generated pages take the terms page's stylesheets.
    writeFileSync(
      join(output, "terms.html"),
      '<!doctype html><link rel="stylesheet" href="/assets/terms.css">',
    );
    for (const page of ["account.html", "friends.html", "friends/invite.html"])
      writeFileSync(join(output, page), "<!doctype html>");
    // The list's HTML, whose head and root each prefecture's page is made
    // from (`src/pages/cards/static-catalog.tsx`).
    writeFileSync(
      join(output, "cards.html"),
      readFileSync("cards.html", "utf8"),
    );
    const result = spawnSync(
      process.execPath,
      [resolve("scripts/build/prepare.mjs"), "--fixture"],
      { cwd, encoding: "utf8" },
    );
    expect(result.status, result.stderr).toBe(0);
    expect(existsSync(join(output, "index.html.br"))).toBe(true);
    expect(existsSync(join(output, "about.html.br"))).toBe(true);
    expect(existsSync(join(output, "about.html.gz"))).toBe(true);
    expect(existsSync(join(output, "sw.js"))).toBe(false);
    for (const page of ["friends.html", "friends/invite.html"]) {
      expect(existsSync(join(output, page + ".br"))).toBe(true);
      expect(existsSync(join(output, page + ".gz"))).toBe(true);
    }
    expect(readFileSync(join(output, "sitemap.xml"), "utf8")).not.toContain(
      "/friends",
    );
    // A prefecture's list is a page at the old prefecture page's path,
    // which nothing redirects any more.
    expect(existsSync(join(output, "_redirects"))).toBe(false);
    for (const slug of ["hokkaido", "tokyo", "okinawa", "other"])
      expect(existsSync(join(output, `pref/${slug}/index.html`))).toBe(true);
    const tokyo = readFileSync(join(output, "pref/tokyo/index.html"), "utf8");
    expect(tokyo).toContain('href="/card/TEST-TOKYO-1/"');
    // The synthetic build says so where its cards are read.
    expect(tokyo).toContain("検証用の架空データ");
    expect(tokyo).toContain(
      '<link rel="canonical" href="https://manhole-techo.com/pref/tokyo/" />',
    );
    // The whole list leads to each of them, and stays among the files that
    // are compressed ahead: as it was filled.
    const list = readFileSync(join(output, "cards.html"), "utf8");
    expect(list).toContain('href="/pref/tokyo/"');
    expect(
      brotliDecompressSync(
        readFileSync(join(output, "cards.html.br")),
      ).toString(),
    ).toBe(list);
    expect(readFileSync(join(output, "sitemap.xml"), "utf8")).toContain(
      "https://manhole-techo.com/pref/tokyo/",
    );
    expect(
      readFileSync(join(output, "card/TEST-TOKYO-1/index.html"), "utf8"),
    ).toContain("合成テスト共同配布所");
    expect(readFileSync(join(output, "sitemap.xml"), "utf8")).toContain(
      "/card/TEST-TOKYO-1/",
    );
    expect(readFileSync(join(output, "robots.txt"), "utf8")).toContain(
      "Sitemap:",
    );
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
