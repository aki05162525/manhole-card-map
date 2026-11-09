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
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1200, height: 630 },
    deviceScaleFactor: 1,
  });
  await page.setContent(
    `<style>${css}body{margin:0;background:#f3f1ec;color:#1d2321;font-family:"Noto Sans JP Variable",sans-serif}.art{height:630px;display:flex;align-items:center;gap:54px;padding:0 80px;box-sizing:border-box;border-top:16px solid #2e6f62}svg{flex-shrink:0;color:#2e6f62}h1{font-size:64px;letter-spacing:-2px;margin:0 0 26px;font-weight:750}p{font-size:28px;line-height:1.8;margin:0}</style><div class="art">${mark}<div><h1>マンホール手帳</h1><p>全国のマンホールカード<br>配布場所マップ</p></div></div>`,
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
