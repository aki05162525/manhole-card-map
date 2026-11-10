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
// The distribution places themselves draw the country: one dot per pin of the
// generated data (run `bun run build` or the data build first).
const { pins } = JSON.parse(
  await readFile(new URL("public/data/pins.json", root), "utf8"),
);
const statusColor = {
  active: "#2e6f62",
  upcoming: "#3d4f9a",
  suspended: "#8a5a00",
};
const map = { x: 620, y: 36, width: 540, height: 558 };
// Only the four main islands are drawn; the picture is an illustration, and
// the southern and remote islands would shrink it to a thin strip.
const places = pins.filter(
  (pin) =>
    pin.kind !== "lid" &&
    pin.lng > 128.5 &&
    pin.lng < 146.5 &&
    pin.lat > 30.5 &&
    pin.lat < 46,
);
if (places.length < 100) throw new Error("pins.json has too few places");
const mercator = (lat) =>
  Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
const xs = places.map((pin) => (pin.lng * Math.PI) / 180);
const ys = places.map((pin) => mercator(pin.lat));
const [west, east] = [Math.min(...xs), Math.max(...xs)];
const [south, north] = [Math.min(...ys), Math.max(...ys)];
const scale = Math.min(map.width / (east - west), map.height / (north - south));
const dots = places
  .map((pin, index) => {
    const x =
      map.x +
      (map.width - (east - west) * scale) / 2 +
      (xs[index] - west) * scale;
    const y =
      map.y +
      (map.height - (north - south) * scale) / 2 +
      (north - ys[index]) * scale;
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.4" fill="${statusColor[pin.status] ?? "#9a968c"}"/>`;
  })
  .join("");
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
.dots{position:absolute;inset:0;opacity:.82}
.copy{position:absolute;left:72px;top:0;bottom:56px;width:560px;display:flex;flex-direction:column;justify-content:center}
.brand{display:flex;align-items:center;gap:20px;font-size:40px;font-weight:700;letter-spacing:.04em;font-feature-settings:"palt"}
.brand span span{font-weight:500}
.brand svg{width:76px;height:76px;flex-shrink:0;color:#2e6f62}
h1{margin:40px 0 0;font-size:54px;line-height:1.36;white-space:nowrap;font-weight:800;letter-spacing:-.01em;font-feature-settings:"palt"}
p{margin:24px 0 0;font-size:25px;line-height:1.6;color:#5f625e;font-weight:500}
.url{position:absolute;left:72px;bottom:44px;font-size:24px;font-weight:600;letter-spacing:.02em;color:#2e6f62}
</style><div class="art"><svg class="dots" width="1200" height="630" viewBox="0 0 1200 630">${dots}</svg><div class="copy"><div class="brand">${mark}<span>マンホール<span>手帳</span></span></div><h1>カードの配布場所を、<br>地図でさがす。</h1><p>全国のマンホールカードの配布場所と<br>蓋の位置をまとめた地図</p></div><div class="url">manhole-techo.com</div></div>`,
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
