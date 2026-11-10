// Run manually after editing the artwork: node scripts/generate-seo-images.mjs
// Uses the existing logo's paths and local font package; no network or new font payload.
import { readFile } from "node:fs/promises";
import { chromium } from "playwright";
const root = new URL("../", import.meta.url);
const logo = await readFile(new URL("src/shared/ui/logo.tsx", root), "utf8");
const paths = logo
  .split(") : (")[1]
  .split("</>")[0]
  .replace(/<>/, "")
  .replace(/strokeDasharray=\{incomplete \? "2 1.4" : undefined\}/, "")
  .replaceAll(/strokeWidth=/g, "stroke-width=")
  .replaceAll(/strokeDasharray=/g, "stroke-dasharray=");
const tape =
  '<path d="M19.8 5.5h6.4l-1.1.9 1.1.9-1.1.9 1.1.9h-6.4l1.1-.9-1.1-.9 1.1-.9z" transform="rotate(7 23 7.3)" fill="currentColor" fill-opacity=".35" stroke-width=".6"/>';
const mark = `<svg width="240" height="240" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-linejoin="round">${paths}${tape}</svg>`;
const fontCSS = await readFile(
  new URL("node_modules/@fontsource-variable/noto-sans-jp/wght.css", root),
  "utf8",
);
const embedded = await Promise.all(
  [...fontCSS.matchAll(/url\(([^)]+)\)/g)].map(async ([match, file]) => [
    match,
    `url(data:font/woff2;base64,${(await readFile(new URL("node_modules/@fontsource-variable/noto-sans-jp/" + file, root))).toString("base64")})`,
  ]),
);
let css = fontCSS;
for (const [match, value] of embedded) css = css.replaceAll(match, value);
// The country on the right: the land from og-outline.json (tools/map/og_outline.py),
// the prefecture borders the map itself uses, and one dot per distribution
// place of the generated data (run the data build first). Only the four main
// islands are drawn; this is an illustration, not a map to read positions from.
const json = async (path) =>
  JSON.parse(await readFile(new URL(path, root), "utf8"));
const outline = await json("scripts/og-outline.json");
const borders = await json("src/pref-borders.json");
const { pins } = await json("public/data/pins.json");
const statusColor = {
  active: "#2e6f62",
  upcoming: "#3d4f9a",
  suspended: "#8a5a00",
};
const map = { x: 610, y: 30, width: 560, height: 570 };
const mercator = (lat) =>
  Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
const rings = outline.rings.map((ring) =>
  Array.from({ length: ring.length / 2 }, (_, index) => [
    ring[index * 2] * outline.grid,
    ring[index * 2 + 1] * outline.grid,
  ]),
);
const land = rings.flat();
const lngs = land.map(([lng]) => lng);
const lats = land.map(([, lat]) => lat);
const [west, east] = [Math.min(...lngs), Math.max(...lngs)];
const [south, north] = [Math.min(...lats), Math.max(...lats)];
const radians = (lng) => (lng * Math.PI) / 180;
const scale = Math.min(
  map.width / radians(east - west),
  map.height / (mercator(north) - mercator(south)),
);
const left = map.x + (map.width - radians(east - west) * scale) / 2;
const top =
  map.y + (map.height - (mercator(north) - mercator(south)) * scale) / 2;
const point = ([lng, lat]) =>
  `${(left + radians(lng - west) * scale).toFixed(1)} ${(top + (mercator(north) - mercator(lat)) * scale).toFixed(1)}`;
const line = (points) => `M${points.map(point).join("L")}`;
const landPath = rings.map((ring) => `${line(ring)}Z`).join("");
const inside = ([lng, lat]) =>
  lng >= west && lng <= east && lat >= south && lat <= north;
const borderPath = borders.features
  .filter(({ geometry }) => geometry.coordinates.every(inside))
  .map(({ geometry }) => line(geometry.coordinates))
  .join("");
const places = pins.filter(
  (pin) => pin.kind !== "lid" && inside([pin.lng, pin.lat]),
);
if (places.length < 100) throw new Error("pins.json has too few places");
const dots = places
  .map(
    (pin) =>
      `<circle r="3.1" fill="${statusColor[pin.status] ?? "#8d897f"}" transform="translate(${point([pin.lng, pin.lat])})"/>`,
  )
  .join("");
const country = `<path d="${landPath}" fill="#fbfaf7" fill-rule="evenodd" stroke="#b9b3a6" stroke-width="1.6" stroke-linejoin="round"/><path d="${borderPath}" fill="none" stroke="#dcd7cc" stroke-width="1.2" stroke-linejoin="round"/><g opacity=".9">${dots}</g>`;
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1200, height: 630 },
    deviceScaleFactor: 1,
  });
  await page.setContent(
    `<style>${css}
body{margin:0;background:#f3f1ec;color:#1d2321;font-family:"Noto Sans JP Variable",sans-serif}
.art{position:relative;width:1200px;height:630px;overflow:hidden}
.dots{position:absolute;inset:0}
.copy{position:absolute;left:72px;top:0;bottom:56px;width:560px;display:flex;flex-direction:column;justify-content:center}
.brand{display:flex;align-items:center;gap:20px;font-size:40px;font-weight:700;letter-spacing:.04em;font-feature-settings:"palt"}
.brand svg{width:76px;height:76px;flex-shrink:0;color:#2e6f62}
h1{margin:40px 0 0;font-size:54px;line-height:1.36;white-space:nowrap;font-weight:800;letter-spacing:-.01em;font-feature-settings:"palt"}
p{margin:24px 0 0;font-size:25px;line-height:1.6;color:#5f625e;font-weight:500}
.url{position:absolute;left:72px;bottom:44px;font-size:24px;font-weight:600;letter-spacing:.02em;color:#2e6f62}
</style><div class="art"><svg class="dots" width="1200" height="630" viewBox="0 0 1200 630">${country}</svg><div class="copy"><div class="brand">${mark}<span>マンホール手帳</span></div><h1>カードの配布場所を、<br>地図でさがす。</h1><p>全国のマンホールカードの配布場所と<br>蓋の位置をまとめた地図</p></div><div class="url">manhole-techo.com</div></div>`,
  );
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({
    path: new URL("public/og-image.png", root).pathname,
  });
  await page.setViewportSize({ width: 180, height: 180 });
  await page.setContent(
    `<style>body{margin:0;background:#f3f1ec;color:#2e6f62;display:grid;place-items:center;height:180px}svg{width:140px;height:140px}</style>${mark}`,
  );
  await page.screenshot({
    path: new URL("public/apple-touch-icon.png", root).pathname,
  });
} finally {
  await browser.close();
}
