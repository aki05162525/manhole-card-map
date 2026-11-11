// Manual regression checks for the map design. Uses synthetic data and an
// actual MapLibre canvas; it does not certify the real basemap or phone speed.
import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "node:net";
import { readFile, readdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const port = Number(process.env.MAP_DESIGN_PORT || 4187);
const origin = `http://127.0.0.1:${port}`;
const probe = createServer();
await new Promise((resolve, reject) => {
  probe.once("error", reject);
  probe.listen(port, "127.0.0.1", resolve);
});
await new Promise((resolve) => probe.close(resolve));
console.log(`Map design test server: ${origin}`);
const assets = await readdir("dist-fixture/assets");
const library =
  "/assets/" + assets.find((name) => /^maplibre-gl-.*\.js$/.test(name));
const fixture = JSON.parse(
  await readFile("dist-fixture/data/full.json", "utf8"),
);
fixture.evaluatedAt = "2026-11-06";
const counts = [
  ["北海道", 67, 142.5, 43.5],
  ["青森県", 100, 140.5, 39],
  ["東京都", 454, 139.8, 35.7],
  ["愛知県", 212, 137.5, 36.1],
  ["大阪府", 109, 135.8, 34.78],
  ["広島県", 63, 133, 35.3],
  ["高知県", 65, 133.1, 33.35],
  ["福岡県", 78, 130.6, 32.7],
  ["沖縄県", 11, 127.8, 26.5],
];
fixture.places = [];
fixture.pins = [];
for (const [pref, count, lng, lat] of counts)
  for (let i = 0; i < count; i++) {
    const id = `${pref}-${i}`;
    fixture.places.push({
      id,
      name: "合成テスト",
      address: "架空",
      phone: "",
      coordinate: { status: "confirmed", lng, lat },
    });
    fixture.pins.push({
      id,
      pref,
      kind: "place",
      cardIds: [id],
      status: "active",
      lng,
      lat,
    });
  }
// Make the detail fill its permitted height, including at large text sizes.
fixture.cards[0].hours = Array.from(
  { length: 30 },
  () => "9:00–17:00（合成テスト、実在の施設ではありません）",
);
const style = {
  version: 8,
  glyphs:
    "https://tiles.basemaps.cartocdn.com/v/20261026-01/fonts/{fontstack}/{range}.pbf",
  sources: {},
  layers: [
    {
      id: "background",
      type: "background",
      paint: { "background-color": "#efede8" },
    },
  ],
};
const server = spawn(process.execPath, ["scripts/serve.mjs"], {
  env: { ...process.env, PORT: String(port), SERVE_DIR: "dist-fixture" },
  stdio: ["ignore", "pipe", "inherit"],
});
let browser;
const failures = [];
async function check(name, run) {
  if (
    process.env.MAP_DESIGN_CASE &&
    !name.startsWith(process.env.MAP_DESIGN_CASE)
  )
    return;
  try {
    await run();
    console.log(`PASS ${name}`);
  } catch (error) {
    failures.push({ name, error: String(error) });
    console.error(`FAIL ${name}: ${error}`);
  }
}
async function context(viewport) {
  const ctx = await browser.newContext({ viewport, reducedMotion: "reduce" });
  ctx.setDefaultTimeout(5000);
  await ctx.route(origin + "/", async (route) => {
    const response = await route.fetch();
    const html = await response.text();
    // Capture the real map through its public prototype before starting the app.
    await route.fulfill({
      response,
      body: html.replace(
        /<script type="module" crossorigin src="([^"]+)"><\/script>/,
        (_, entry) =>
          `<script type="module">import {Map} from "${library}"; const original=Map.prototype.setStyle; Map.prototype.setStyle=function(...args){window.testMap=this;return original.apply(this,args)}; import("${entry}");</script>`,
      ),
    });
  });
  await ctx.route("**/data/full.json", (route) =>
    route.fulfill({ json: fixture }),
  );
  await ctx.route("**/map-style.json", (route) =>
    route.fulfill({ json: style }),
  );
  return ctx;
}
try {
  await new Promise((resolve, reject) => {
    server.stdout.once("data", resolve);
    server.once("error", reject);
    server.once("exit", (code) => reject(Error(`Server exited ${code}`)));
  });
  browser = await chromium.launch({ headless: true });
  for (const width of [412, 1440]) {
    const height = width === 412 ? 915 : 900;
    await check(`E1 badges and labels at ${width}px`, async () => {
      const ctx = await context({ width, height });
      try {
        const page = await ctx.newPage();
        await page.goto(origin);
        await page.waitForFunction(() => window.prototype?.metrics.ready > 0);
        // Wait for glyphs and placement, not a fixed animation delay.
        await page.evaluate(
          () =>
            new Promise((resolve) => {
              if (window.testMap.loaded() && !window.testMap.isMoving())
                resolve();
              else window.testMap.once("idle", resolve);
            }),
        );
        const result = await page.evaluate(() => {
          const map = window.testMap;
          const circles = map.queryRenderedFeatures({
            layers: ["card-level-counts"],
          });
          const labels = ["card-count-names-area", "card-count-names-pref"];
          const zoom = map.getZoom();
          const evaluate = (value, props) => {
            if (!Array.isArray(value)) return value;
            const [op, ...args] = value;
            if (op === "get") return props[args[0]];
            if (op === "zoom") return zoom;
            if (op === "==")
              return evaluate(args[0], props) === evaluate(args[1], props);
            if (op === "case")
              return evaluate(args[0], props)
                ? evaluate(args[1], props)
                : evaluate(args[2], props);
            if (op === "max")
              return Math.max(...args.map((v) => evaluate(v, props)));
            if (op === "*")
              return evaluate(args[0], props) * evaluate(args[1], props);
            if (op === "-")
              return evaluate(args[0], props) - evaluate(args[1], props);
            if (op === "/")
              return evaluate(args[0], props) / evaluate(args[1], props);
            if (op === "interpolate") {
              const z = evaluate(args[1], props);
              if (z <= args[2]) return evaluate(args[3], props);
              for (let i = 4; i < args.length; i += 2)
                if (z < args[i]) {
                  const t = (z - args[i - 2]) / (args[i] - args[i - 2]);
                  return (
                    evaluate(args[i - 1], props) * (1 - t) +
                    evaluate(args[i + 1], props) * t
                  );
                }
              return evaluate(args.at(-1), props);
            }
            throw Error(op);
          };
          const expression = map.getPaintProperty(
            "card-level-counts",
            "circle-radius",
          );
          const points = circles.map((f) => ({
            id: f.properties.id,
            p: map.project(f.geometry.coordinates),
            radius: evaluate(expression, f.properties),
          }));
          const clashes = [];
          for (let i = 0; i < points.length; i++)
            for (let j = i + 1; j < points.length; j++) {
              const a = points[i],
                b = points[j];
              if (
                Math.hypot(a.p.x - b.p.x, a.p.y - b.p.y) <
                a.radius + b.radius + 4
              )
                clashes.push([a.id, b.id]);
            }
          const labelClashes = points.flatMap(({ id, p, radius }) =>
            map
              .queryRenderedFeatures(
                [
                  [p.x - radius - 2, p.y - radius - 2],
                  [p.x + radius + 2, p.y + radius + 2],
                ],
                { layers: labels },
              )
              // Symbol queries include collision padding around their own
              // label. Its visible four-pixel gap is covered by pure tests.
              .filter((f) => f.properties.id !== id)
              .map((f) => [id, f.properties.id]),
          );
          return {
            zoom,
            circles: circles.length,
            labels: map.queryRenderedFeatures({ layers: labels }).length,
            clashes,
            labelClashes,
          };
        });
        console.log(JSON.stringify({ width, ...result }));
        if (process.env.MAP_DESIGN_SCREENSHOTS)
          await page.screenshot({ path: `/tmp/phase3-map-${width}.png` });
        assert.equal(result.circles, 9);
        assert.equal(
          result.labels,
          9,
          "Every regional name must remain visible",
        );
        assert.deepEqual(result.clashes, []);
        assert.deepEqual(result.labelClashes, []);
      } finally {
        await ctx.close();
      }
    });
  }
  await check(
    "E2 style HTTP 404 displays failure within five seconds",
    async () => {
      const ctx = await context({ width: 412, height: 823 });
      try {
        await ctx.route("**/map-style.json", (route) =>
          route.fulfill({ status: 404, body: "missing" }),
        );
        const page = await ctx.newPage();
        const start = Date.now();
        await page.goto(origin);
        await page
          .getByText("背景地図を読み込めませんでした。検索と一覧は使えます。", {
            exact: true,
          })
          .waitFor({ timeout: 5000 });
        assert.ok(Date.now() - start < 5000);
        await page
          .getByRole("link", { name: "一覧を開く", exact: true })
          .waitFor();
        assert.equal(
          await page
            .getByRole("button", { name: "カードを検索", exact: true })
            .isEnabled(),
          true,
        );
        console.log(`style failure: ${Date.now() - start}ms`);
      } finally {
        await ctx.close();
      }
    },
  );
  for (const width of [412, 1440]) {
    await check(`E3 attribution with long detail at ${width}px`, async () => {
      const ctx = await context({ width, height: width === 412 ? 823 : 900 });
      try {
        const page = await ctx.newPage();
        // Matching source attribution is deliberately long enough to extend under
        // the desktop detail panel when placed at the bottom right.
        await ctx.route("**/map-style.json", (route) =>
          route.fulfill({
            json: {
              ...style,
              sources: {
                credit: {
                  type: "geojson",
                  data: { type: "FeatureCollection", features: [] },
                  attribution:
                    '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a> © <a href="https://carto.com/attributions">CARTO</a>',
                },
              },
              layers: [
                ...style.layers,
                { id: "credit", type: "circle", source: "credit" },
              ],
            },
          }),
        );
        await page.goto(origin);
        await page.waitForFunction(() => window.prototype?.metrics.ready > 0);
        await page
          .getByRole("button", { name: "カードを検索", exact: true })
          .click();
        await page.getByRole("searchbox").fill("TEST-TOKYO-1");
        await page.locator(".map-search-results button").first().click();
        await page.locator("#detail .detail-heading h2").waitFor();
        if (
          !(await page
            .locator(".maplibregl-ctrl-attrib")
            .evaluate((el) => el.classList.contains("maplibregl-compact-show")))
        )
          await page.locator(".maplibregl-ctrl-attrib-button").click();
        await page.waitForFunction(() => {
          const link = document.querySelector(
            '.maplibregl-ctrl-attrib a[href*="openstreetmap"]',
          );
          const rect = link?.getClientRects()[0];
          return (
            rect &&
            link.contains(
              document.elementFromPoint(
                rect.x + rect.width / 2,
                rect.y + rect.height / 2,
              ),
            )
          );
        });
        const detail = await page.locator("#detail").boundingBox();
        const attrib = await page
          .locator(".maplibregl-ctrl-attrib")
          .boundingBox();
        assert.ok(
          Math.abs(attrib.x + attrib.width - (width - 16)) < 1,
          "attribution right gutter",
        );
        const intersects =
          detail.x < attrib.x + attrib.width &&
          detail.x + detail.width > attrib.x &&
          detail.y < attrib.y + attrib.height &&
          detail.y + detail.height > attrib.y;
        assert.equal(intersects, false);
        if (process.env.MAP_DESIGN_SCREENSHOTS)
          await page.screenshot({ path: `/tmp/phase3-detail-${width}.png` });
        const credit = page.locator(
          '.maplibregl-ctrl-attrib a[href*="openstreetmap"]',
        );
        const box = await credit.boundingBox();
        assert.ok(box);
        assert.equal(
          await credit.evaluate((el) => {
            const r = el.getClientRects()[0];
            return el.contains(
              document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2),
            );
          }),
          true,
        );
        if (width > 1000) {
          const locate = await page.locator("#locate").boundingBox();
          const zoom = await page
            .getByRole("button", { name: "Zoom in", exact: true })
            .boundingBox();
          assert.ok(
            Math.abs(locate.x + locate.width / 2 - zoom.x - zoom.width / 2) < 1,
          );
        }
        console.log(JSON.stringify({ width, detail, attrib }));
      } finally {
        await ctx.close();
      }
    });
  }
  await check("E4 offline reference date stays whole at 412px", async () => {
    const ctx = await context({ width: 412, height: 823 });
    try {
      const page = await ctx.newPage();
      await page.goto(origin);
      await page.waitForFunction(() => window.prototype?.metrics.ready > 0);
      await ctx.setOffline(true);
      const date = page.getByText("2026-11-06", { exact: true });
      await date.waitFor();
      assert.equal(
        await date.evaluate((el) => getComputedStyle(el).whiteSpace),
        "nowrap",
      );
      assert.equal(await date.evaluate((el) => el.getClientRects().length), 1);
      assert.equal(
        await date.locator("..").textContent(),
        "オフラインです。基準日 2026-11-06 時点の情報を表示しています",
      );
      assert.deepEqual(
        await date.locator("..").evaluate((el) => {
          const s = getComputedStyle(el);
          return [s.paddingTop, s.paddingRight];
        }),
        ["8px", "12px"],
      );
    } finally {
      await ctx.close();
    }
  });
  assert.deepEqual(failures, []);
} finally {
  await browser?.close();
  const stopped = once(server, "exit");
  server.kill();
  await stopped;
  console.log("Map design test server stopped");
}
