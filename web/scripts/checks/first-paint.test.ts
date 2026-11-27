import { afterEach, expect, test } from "vitest";
import { readFile } from "node:fs/promises";
import {
  buildStageScript,
  checkFirstPaint,
  cspFor,
  criticalCss,
  firstPaint,
  inlineHashes,
  withCspHashes,
  withFirstPaint,
} from "../build/first-paint.mjs";
import { renderMapShell, withMapShell } from "../../src/pages/map/map-shell";
import {
  mapSummaryAttributes,
  summarizeMap,
} from "../../src/domain/map-summary";
import { fixtureData } from "../build/fixtures";

// The map's HTML as the build writes it, from a page like index.html: its
// root with the counts, its module and its stylesheets in the head.
const summary = summarizeMap(fixtureData);
const css = `:root{--paper:#fff;--unused:red}body{margin:0}
.level-stage{position:absolute;background:var(--paper)}
.level-badge::after{content:""}
.detail-sheet{position:fixed}`;
const index = `<!doctype html><html><head><title>map</title>
<script type="module" src="/assets/main.js"></script>
<link rel="stylesheet" href="/assets/map.css"></head><body>
<div id="root" ${mapSummaryAttributes(summary)}></div>
</body></html>`;
async function built(mode = "fixture") {
  const drawn = withMapShell(
    index,
    renderMapShell(summary.counts),
    await buildStageScript(mode),
  );
  return withFirstPaint(drawn, criticalCss(drawn, css));
}

const accounts = process.env.VITE_ACCOUNTS_ENABLED;
afterEach(() => {
  if (accounts === undefined) delete process.env.VITE_ACCOUNTS_ENABLED;
  else process.env.VITE_ACCOUNTS_ENABLED = accounts;
});

test("draws the national level and its counts from the HTML alone", async () => {
  const html = await built();
  const badges = checkFirstPaint(html);
  // The fixture's cards are in Tokyo.
  expect(badges.map(({ id, label }) => [id, label])).toContainEqual([
    "kanto",
    `関東 ${summary.counts.areas.kanto}枚`,
  ]);
  expect(badges).toHaveLength(9);
  // Its rules are in the head, its stylesheets after its drawing.
  const head = html.slice(0, html.indexOf("</head>"));
  expect(head).toContain(".level-stage{position:absolute");
  expect(head).not.toContain("detail-sheet");
  expect(head).not.toContain("--unused");
  expect(html.indexOf('href="/assets/map.css"')).toBeGreaterThan(
    html.indexOf("<script>"),
  );
});

test("leaves a card's detail, a region and a friend's map to the page's script", async () => {
  process.env.VITE_ACCOUNTS_ENABLED = "true";
  const html = await built();
  // The bar of the public map is no friend's header.
  const friend = firstPaint(html, { url: "https://example.test/?friend=f1" });
  expect(friend.querySelector(".level-stage")).toBeNull();
  expect(friend.querySelector(".map-search-bar")).toBeNull();
  // Not one count of the public map is in the page.
  expect(friend.getElementById("root")!.textContent).not.toMatch(/\d/);
  const card = firstPaint(html, {
    url: "https://example.test/?card=13-101-A001",
  });
  expect(card.querySelector(".level-stage")).toBeNull();
  expect(card.querySelector(".map-search-bar")).not.toBeNull();
  // A reload in a region keeps the region in its history entry.
  const region = firstPaint(html, {
    state: { mapFocus: { area: "kanto", pref: null } },
  });
  expect(region.querySelector(".level-stage")).toBeNull();
  // Without accounts, `friend` names no one: the public map is drawn.
  delete process.env.VITE_ACCOUNTS_ENABLED;
  const ignored = firstPaint(await built(), {
    url: "https://example.test/?friend=f1",
  });
  expect(ignored.querySelectorAll("[data-measured] .level-badge")).toHaveLength(
    9,
  );
});

test("allows the map's own script and style by their hashes, and nothing else", async () => {
  const html = await built();
  const headers = await readFile("deploy/_headers", "utf8");
  const allowed = withCspHashes(headers, inlineHashes(html));
  expect(() => checkFirstPaint(html, { headers: allowed })).not.toThrow();
  expect(() => checkFirstPaint(html, { headers })).toThrow(
    "the CSP blocks the map's own script",
  );
  // One policy, as Cloudflare serves it: a rule of the map's own that
  // detaches it and sets another is answered with both, the stricter of
  // which blocks the script.
  expect(allowed.match(/Content-Security-Policy/g)).toHaveLength(1);
  expect(() =>
    checkFirstPaint(html, {
      headers: `${headers}/\n  ! Content-Security-Policy\n  Content-Security-Policy: ${cspFor(allowed, "/")}\n`,
    }),
  ).toThrow("a detached CSP");
  expect(() =>
    checkFirstPaint(html, {
      headers: `${allowed}/\n  Content-Security-Policy: ${cspFor(headers, "/")}\n`,
    }),
  ).toThrow("the CSP blocks the map's own script");
  expect(() =>
    checkFirstPaint(
      html.replace("</title>", '</title><link rel="stylesheet" href="/a.css">'),
    ),
  ).toThrow("a stylesheet holds the first paint back");
});

test("keeps the order of the layers it leaves empty", () => {
  expect(
    criticalCss(
      "<button>first</button>",
      "@layer first{.later{color:red}}@layer second{button{color:blue}}",
    ),
  ).toBe("@layer first;@layer second{button{color:blue}}");
  // Once named, a layer's order is set: an empty one again adds nothing.
  expect(
    criticalCss(
      "<button>first</button>",
      "@layer a{button{color:blue}}@layer b{.later{color:red}}@layer a{.later{color:red}}@layer b{.later{color:red}}",
    ),
  ).toBe("@layer a{button{color:blue}}@layer b;");
});

test("leaves a screen whose national level shows the prefectures to the page", async () => {
  const html = await built();
  // So wide a screen that the whole country opens close enough for the
  // prefectures: the script stops short of placing them.
  const errors: unknown[] = [];
  const wide = firstPaint(html, {
    size: { width: 8000, height: 6000 },
    onError: (error) => errors.push(error),
  });
  expect(errors).toEqual([]);
  expect(wide.querySelector(".level-stage")).toBeNull();
  expect(wide.querySelector(".map-search-bar")).not.toBeNull();
});
