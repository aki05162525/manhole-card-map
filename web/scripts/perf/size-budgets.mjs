// Bytes, Brotli quality 11, without depending on generated chunk hashes.
// "all …" budgets sum every page's assets, shared and lazy chunks included, so
// they catch growth anywhere. "map entry CSS" sums only the stylesheets that
// index.html links, so growth on map startup shows up on its own.
export const budgets = [
  {
    name: "module worker",
    pattern: /\/assets\/maplibre-gl-worker-.*\.m?js$/,
    limit: 130_000,
  },
  // 522,816 bytes, plus 2%: 519,222 before a prefecture was drawn without
  // the map engine (features/map/pref-stage.tsx and its press, ledger and
  // camera, about 3.6KB), which the map engine is no longer read for.
  { name: "all JavaScript", pattern: /\/assets\/.*\.m?js$/, limit: 533_000 },
  {
    name: "MapLibre",
    pattern: /\/assets\/maplibre-gl-(?!worker-).*\.m?js$/,
    limit: 250_000,
  },
  // 32,347 bytes, plus 2%, since the pages dropped the web font's sheet.
  // Shared rules live in shared/ui/controls.css to keep one copy.
  // Includes the map detail and its enlarged card image.
  { name: "all CSS", pattern: /\/assets\/.*\.css$/, limit: 33_000 },
  // 14,006 bytes, plus 2%: the tokens and the screen's own CSS (map-screen,
  // site-menu, app, card-data), which the page's script waits for. They are
  // linked after the HTML's own drawing, whose rules the HTML holds
  // (below), so its first paint waits for none of them.
  {
    name: "map entry CSS",
    pattern: /\/assets\/.*\.css$/,
    entry: "index.html",
    limit: 14_300,
  },
  // 13,397 bytes, plus 2%: the map's HTML draws its first view by itself,
  // the search bar and the national level (its coast, about 3.3KB), with
  // the script that places it (about 5.4KB) and the rules they use (about
  // 2.4KB; scripts/build/first-paint.mjs). 2,115 before, with the bar alone,
  // when the first paint waited for the stylesheets above.
  { name: "map HTML", pattern: /^[^/]+\/index\.html$/, limit: 13_700 },
  // Pages are written in the device's fonts: a web font's sheet held the
  // first paint back, and its files shared the line with the map.
  { name: "web fonts", pattern: /\.woff2?$/, absent: true },
];
export function checkBudgets(rows, limits = budgets) {
  return limits.map(({ name, pattern, entry, limit, absent }) => {
    if (absent) {
      const found = rows.filter((row) => pattern.test(row.file));
      if (found.length)
        throw new Error(`${name}: ${found[0].file} must not be built`);
      return { name, brotli: 0, limit: 0 };
    }
    const matches = rows.filter(
      (row) =>
        pattern.test(row.file) && (!entry || row.entries?.includes(entry)),
    );
    if (!matches.length) throw new Error(`${name}: missing budget inputs`);
    const bytes = matches.reduce((total, row) => total + row.brotli, 0);
    if (!Number.isFinite(bytes) || bytes > limit)
      throw new Error(
        `${name}: ${bytes} bytes exceeds ${limit} bytes Brotli budget`,
      );
    return { name, brotli: bytes, limit };
  });
}

/** Stylesheet hrefs an HTML page links (not preloads or other links). */
export function linkedStylesheets(html) {
  return [...html.matchAll(/<link\b[^>]*>/gi)]
    .map(([tag]) => tag)
    .filter((tag) => /\brel=["']?stylesheet\b/i.test(tag))
    .map((tag) => tag.match(/\bhref=["']([^"']+)["']/i)?.[1])
    .filter(Boolean);
}
